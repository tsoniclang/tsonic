import type {
  CSharpBooleanLiteralExpressionAst,
  CSharpCharLiteralExpressionAst,
  CSharpIdentifierExpressionAst,
  CSharpNullLiteralExpressionAst,
  CSharpNumericLiteralExpressionAst,
  CSharpNumericLiteralSuffix,
  CSharpQualifiedIdentifierExpressionAst,
  CSharpQualifiedNameAst,
  CSharpStringLiteralExpressionAst,
  CSharpTypeAst,
} from "./types.js";
import { isCSharpPredefinedTypeKeyword } from "./utils.js";

export const nullLiteral = (): CSharpNullLiteralExpressionAst => ({
  kind: "nullLiteralExpression",
});

export const booleanLiteral = (
  value: boolean
): CSharpBooleanLiteralExpressionAst => ({
  kind: "booleanLiteralExpression",
  value,
});

export const stringLiteral = (
  value: string
): CSharpStringLiteralExpressionAst => ({
  kind: "stringLiteralExpression",
  value,
});

export const charLiteral = (value: string): CSharpCharLiteralExpressionAst => ({
  kind: "charLiteralExpression",
  value,
});

export const qualifiedName = (value: string): CSharpQualifiedNameAst => {
  const trimmed = value.trim();
  const globalPrefix = "global::";
  const hasAliasQualifier = trimmed.includes("::");
  const aliasQualifier =
    hasAliasQualifier && trimmed.startsWith(globalPrefix)
      ? "global"
      : undefined;
  const body =
    aliasQualifier !== undefined ? trimmed.slice(globalPrefix.length) : trimmed;
  const segments = body.split(".").filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    throw new Error(
      `ICE: Cannot construct qualified name AST from empty name '${value}'.`
    );
  }

  return aliasQualifier !== undefined
    ? { aliasQualifier, segments }
    : { segments };
};

export const identifierExpression = (
  name: string
): CSharpIdentifierExpressionAst | CSharpQualifiedIdentifierExpressionAst =>
  name.includes(".") || name.includes("::")
    ? { kind: "qualifiedIdentifierExpression", name: qualifiedName(name) }
    : { kind: "identifierExpression", identifier: name };

const normalizeGenericTypeArgument = (type: CSharpTypeAst): CSharpTypeAst =>
  type.kind === "predefinedType" && type.keyword === "void"
    ? { kind: "predefinedType", keyword: "object" }
    : type;

const normalizeGenericTypeArguments = (
  typeArguments: readonly CSharpTypeAst[] | undefined
): readonly CSharpTypeAst[] | undefined => {
  if (!typeArguments || typeArguments.length === 0) {
    return typeArguments;
  }

  let changed = false;
  const normalized = typeArguments.map((typeArgument) => {
    const next = normalizeGenericTypeArgument(typeArgument);
    changed ||= next !== typeArgument;
    return next;
  });

  return changed ? normalized : typeArguments;
};

export const identifierType = (
  name: string,
  typeArguments?: readonly CSharpTypeAst[]
): CSharpTypeAst => {
  const normalizedTypeArguments = normalizeGenericTypeArguments(typeArguments);

  return typeArguments === undefined && name === "var"
    ? { kind: "varType" }
    : typeArguments === undefined && isCSharpPredefinedTypeKeyword(name)
      ? { kind: "predefinedType", keyword: name }
      : name.includes(".") || name.includes("::")
        ? {
            kind: "qualifiedIdentifierType",
            name: qualifiedName(name),
            ...(normalizedTypeArguments && normalizedTypeArguments.length > 0
              ? { typeArguments: normalizedTypeArguments }
              : {}),
          }
        : {
            kind: "identifierType",
            name,
            ...(normalizedTypeArguments && normalizedTypeArguments.length > 0
              ? { typeArguments: normalizedTypeArguments }
              : {}),
          };
};

export const withTypeArguments = (
  type: CSharpTypeAst,
  typeArguments: readonly CSharpTypeAst[] | undefined
): CSharpTypeAst => {
  const normalizedTypeArguments = normalizeGenericTypeArguments(typeArguments);
  if (!normalizedTypeArguments || normalizedTypeArguments.length === 0) {
    return type;
  }

  switch (type.kind) {
    case "identifierType":
      return { ...type, typeArguments: normalizedTypeArguments };
    case "qualifiedIdentifierType":
      return { ...type, typeArguments: normalizedTypeArguments };
    default:
      throw new Error(
        `ICE: Cannot attach generic type arguments to non-identifier type '${type.kind}'.`
      );
  }
};

export const nullableType = (underlyingType: CSharpTypeAst): CSharpTypeAst =>
  underlyingType.kind === "nullableType"
    ? underlyingType
    : { kind: "nullableType", underlyingType };

export const decimalIntegerLiteral = (
  value: number | bigint,
  suffix?: Extract<CSharpNumericLiteralSuffix, "L" | "U" | "UL">
): CSharpNumericLiteralExpressionAst => ({
  kind: "numericLiteralExpression",
  base: "decimal",
  wholePart: BigInt(value).toString(10),
  ...(suffix !== undefined ? { suffix } : {}),
});

export const numericLiteral = (
  literal: Omit<CSharpNumericLiteralExpressionAst, "kind">
): CSharpNumericLiteralExpressionAst => {
  const {
    base,
    wholePart,
    fractionalPart,
    exponentSign,
    exponentDigits,
    suffix,
  } = literal;

  return {
    kind: "numericLiteralExpression",
    base,
    wholePart,
    ...(fractionalPart !== undefined ? { fractionalPart } : {}),
    ...(exponentSign !== undefined ? { exponentSign } : {}),
    ...(exponentDigits !== undefined ? { exponentDigits } : {}),
    ...(suffix !== undefined ? { suffix } : {}),
  };
};

const parseScientificParts = (
  normalized: string
):
  | {
      readonly wholePart: string;
      readonly fractionalPart?: string;
      readonly exponentSign?: "+" | "-";
      readonly exponentDigits?: string;
    }
  | undefined => {
  const match = /^(\d+)(?:\.(\d*))?(?:[eE]([+-]?)(\d+))?$/.exec(normalized);
  if (!match) return undefined;

  const wholePart = match[1] ?? "0";
  const fractionalDigits = match[2];
  const hasDecimalPoint = normalized.includes(".");
  const exponentDigits = match[4];
  const exponentSign = match[3];

  return {
    wholePart,
    fractionalPart: hasDecimalPoint
      ? fractionalDigits && fractionalDigits.length > 0
        ? fractionalDigits
        : "0"
      : undefined,
    exponentSign:
      exponentDigits && exponentSign && exponentSign.length > 0
        ? (exponentSign as "+" | "-")
        : undefined,
    exponentDigits,
  };
};

export const parseNumericLiteral = (
  raw: string,
  suffix?: CSharpNumericLiteralSuffix
): CSharpNumericLiteralExpressionAst => {
  const normalized = raw.replace(/_/g, "");

  if (normalized.startsWith("-")) {
    throw new Error(
      `ICE: Negative numeric literal '${raw}' should be represented as a prefix unary expression.`
    );
  }

  if (/^0[xX]/.test(normalized)) {
    return {
      kind: "numericLiteralExpression",
      base: "hexadecimal",
      wholePart: normalized.slice(2).toUpperCase(),
      ...(suffix !== undefined ? { suffix } : {}),
    };
  }

  if (/^0[bB]/.test(normalized)) {
    return {
      kind: "numericLiteralExpression",
      base: "binary",
      wholePart: normalized.slice(2),
      ...(suffix !== undefined ? { suffix } : {}),
    };
  }

  if (/^0[oO]/.test(normalized)) {
    return {
      kind: "numericLiteralExpression",
      base: "decimal",
      wholePart: BigInt(normalized).toString(10),
      ...(suffix !== undefined ? { suffix } : {}),
    };
  }

  if (
    normalized.includes(".") ||
    normalized.includes("e") ||
    normalized.includes("E") ||
    suffix === "f" ||
    suffix === "m"
  ) {
    const parts = parseScientificParts(normalized);
    if (!parts) {
      throw new Error(
        `ICE: Unsupported numeric literal lexeme '${raw}' in C# AST numeric parser.`
      );
    }
    return {
      kind: "numericLiteralExpression",
      base: "decimal",
      wholePart: parts.wholePart,
      ...(parts.fractionalPart !== undefined
        ? { fractionalPart: parts.fractionalPart }
        : {}),
      ...(parts.exponentSign !== undefined
        ? { exponentSign: parts.exponentSign }
        : {}),
      ...(parts.exponentDigits !== undefined
        ? { exponentDigits: parts.exponentDigits }
        : {}),
      ...(suffix !== undefined ? { suffix } : {}),
    };
  }

  return {
    kind: "numericLiteralExpression",
    base: "decimal",
    wholePart: normalized,
    ...(suffix !== undefined ? { suffix } : {}),
  };
};
