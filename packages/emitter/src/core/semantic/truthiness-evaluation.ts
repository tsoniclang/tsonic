/**
 * Truthiness evaluation helpers (AST construction + runtime truthiness)
 *
 * This module provides:
 * - AST construction helpers for boolean-context lowering
 * - The runtime truthiness switch expression builder
 * - Type coercion and analysis helpers for boolean contexts
 * - The `isBooleanType` predicate
 *
 * IMPORTANT:
 * - This operates on IR + emitted AST; it must not import emitExpressionAst to avoid cycles.
 */

import type { IrExpression, IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { allocateLocalName } from "../format/local-names.js";
import { substituteTypeArgs } from "./type-resolution.js";
import {
  booleanLiteral,
  charLiteral,
  decimalIntegerLiteral,
  identifierType as buildIdentifierType,
  numericLiteral,
} from "../format/backend-ast/builders.js";
import type {
  CSharpExpressionAst,
  CSharpPatternAst,
  CSharpPredefinedTypeKeyword,
  CSharpTypeAst,
} from "../format/backend-ast/types.js";

export const stripGlobalPrefix = (name: string): string =>
  name.startsWith("global::") ? name.slice("global::".length) : name;

/**
 * Coerce CLR primitive reference types (System.Boolean, System.Int32, ...) to IR primitiveType.
 *
 * This prevents boolean-context lowering from emitting `x != null` for CLR value types,
 * which is both semantically wrong and can silently miscompile (it compiles with boxing).
 */
export const coerceClrPrimitiveToPrimitiveType = (
  type: IrType
): IrType | undefined => {
  if (type.kind !== "referenceType") return undefined;

  const resolved = type.resolvedClrType ?? type.typeId?.clrName;
  if (!resolved) return undefined;

  const clr = stripGlobalPrefix(resolved);

  switch (clr) {
    case "System.Boolean":
    case "bool":
      return { kind: "primitiveType", name: "boolean" } as IrType;

    case "System.String":
    case "string":
      return { kind: "primitiveType", name: "string" } as IrType;

    case "System.Int32":
    case "int":
      return { kind: "primitiveType", name: "int" } as IrType;

    case "System.Double":
    case "double":
      return { kind: "primitiveType", name: "number" } as IrType;

    case "System.Char":
    case "char":
      return { kind: "primitiveType", name: "char" } as IrType;
  }

  return undefined;
};

/**
 * Expressions that are always boolean in JS/TS, even if the IR is missing inferredType.
 *
 * This makes boolean-context emission robust: comparisons and `!expr` are already valid
 * C# conditions and should not be rewritten to `!= null` fallbacks.
 */
export const isInherentlyBooleanExpression = (expr: IrExpression): boolean => {
  if (expr.kind === "binary") {
    return (
      expr.operator === "==" ||
      expr.operator === "!=" ||
      expr.operator === "===" ||
      expr.operator === "!==" ||
      expr.operator === "<" ||
      expr.operator === ">" ||
      expr.operator === "<=" ||
      expr.operator === ">=" ||
      expr.operator === "instanceof" ||
      expr.operator === "in"
    );
  }

  if (expr.kind === "unary") {
    return expr.operator === "!";
  }

  return false;
};

// ============================================================
// AST construction helpers
// ============================================================

/** Wrap an AST expression in parentheses if it has lower precedence than `is` (relational = 10). */
export const wrapForIs = (ast: CSharpExpressionAst): CSharpExpressionAst => {
  switch (ast.kind) {
    case "assignmentExpression":
    case "conditionalExpression":
    case "lambdaExpression":
    case "throwExpression":
      return { kind: "parenthesizedExpression", expression: ast };
    case "binaryExpression": {
      // Binary operators with precedence < relational (10) need wrapping
      switch (ast.operatorToken) {
        case "??":
        case "||":
        case "&&":
        case "|":
        case "^":
        case "&":
        case "==":
        case "!=":
          return { kind: "parenthesizedExpression", expression: ast };
        default:
          return ast;
      }
    }
    default:
      return ast;
  }
};

export const identifierExpr = (name: string): CSharpExpressionAst => ({
  kind: "identifierExpression",
  identifier: name,
});

export const typeReferenceExpr = (
  type: CSharpTypeAst
): CSharpExpressionAst => ({
  kind: "typeReferenceExpression",
  type,
});

export const predefinedType = (
  keyword: CSharpPredefinedTypeKeyword
): CSharpTypeAst => ({
  kind: "predefinedType",
  keyword,
});

export const identifierType = (name: string): CSharpTypeAst =>
  buildIdentifierType(name);

export const castExpr = (
  type: CSharpTypeAst,
  expression: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "castExpression",
  type,
  expression,
});

export const typePattern = (type: CSharpTypeAst): CSharpPatternAst => ({
  kind: "typePattern",
  type,
});

export const notEqualsExpr = (
  left: CSharpExpressionAst,
  right: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "binaryExpression",
  operatorToken: "!=",
  left,
  right,
});

export const andExpr = (
  left: CSharpExpressionAst,
  right: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "binaryExpression",
  operatorToken: "&&",
  left,
  right,
});

export const notExpr = (operand: CSharpExpressionAst): CSharpExpressionAst => ({
  kind: "prefixUnaryExpression",
  operatorToken: "!",
  operand,
});

export const staticMemberExpr = (
  typeExpr: CSharpExpressionAst,
  memberName: string
): CSharpExpressionAst => ({
  kind: "memberAccessExpression",
  expression: typeExpr,
  memberName,
});

export const callExpr = (
  callee: CSharpExpressionAst,
  args: readonly CSharpExpressionAst[]
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: callee,
  arguments: args,
});

export const makeSwitchArm = (
  pattern: CSharpPatternAst,
  expression: CSharpExpressionAst
): {
  readonly pattern: CSharpPatternAst;
  readonly expression: CSharpExpressionAst;
} => ({ pattern, expression });

export const buildTruthySwitchAst = (tmp: string): CSharpExpressionAst => {
  const tmpExpr = identifierExpr(tmp);

  const typedNonZeroArm = (
    type: CSharpTypeAst,
    zeroExpr: CSharpExpressionAst
  ): {
    readonly pattern: CSharpPatternAst;
    readonly expression: CSharpExpressionAst;
  } =>
    makeSwitchArm(
      typePattern(type),
      notEqualsExpr(castExpr(type, tmpExpr), zeroExpr)
    );

  const floatLikeArm = (
    type: CSharpTypeAst,
    isNaNStaticTypeName: string,
    zeroExpr: CSharpExpressionAst
  ): {
    readonly pattern: CSharpPatternAst;
    readonly expression: CSharpExpressionAst;
  } => {
    const casted = castExpr(type, tmpExpr);
    const nonZero = notEqualsExpr(casted, zeroExpr);
    const isNaNCall = callExpr(
      staticMemberExpr(
        typeReferenceExpr(identifierType(isNaNStaticTypeName)),
        "IsNaN"
      ),
      [castExpr(type, tmpExpr)]
    );
    return makeSwitchArm(
      typePattern(type),
      andExpr(nonZero, notExpr(isNaNCall))
    );
  };

  return {
    kind: "switchExpression",
    governingExpression: tmpExpr,
    arms: [
      makeSwitchArm(
        typePattern(predefinedType("bool")),
        castExpr(predefinedType("bool"), tmpExpr)
      ),
      makeSwitchArm(
        typePattern(predefinedType("string")),
        notEqualsExpr(
          {
            kind: "memberAccessExpression",
            expression: castExpr(predefinedType("string"), tmpExpr),
            memberName: "Length",
          },
          decimalIntegerLiteral(0)
        )
      ),
      typedNonZeroArm(predefinedType("sbyte"), decimalIntegerLiteral(0)),
      typedNonZeroArm(predefinedType("byte"), decimalIntegerLiteral(0)),
      typedNonZeroArm(predefinedType("short"), decimalIntegerLiteral(0)),
      typedNonZeroArm(predefinedType("ushort"), decimalIntegerLiteral(0)),
      typedNonZeroArm(predefinedType("int"), decimalIntegerLiteral(0)),
      typedNonZeroArm(
        predefinedType("uint"),
        numericLiteral({ base: "decimal", wholePart: "0", suffix: "U" })
      ),
      typedNonZeroArm(
        predefinedType("long"),
        numericLiteral({ base: "decimal", wholePart: "0", suffix: "L" })
      ),
      typedNonZeroArm(
        predefinedType("ulong"),
        numericLiteral({ base: "decimal", wholePart: "0", suffix: "UL" })
      ),
      typedNonZeroArm(predefinedType("nint"), decimalIntegerLiteral(0)),
      typedNonZeroArm(predefinedType("nuint"), decimalIntegerLiteral(0)),
      typedNonZeroArm(
        identifierType("global::System.Int128"),
        decimalIntegerLiteral(0)
      ),
      typedNonZeroArm(
        identifierType("global::System.UInt128"),
        decimalIntegerLiteral(0)
      ),
      floatLikeArm(
        identifierType("global::System.Half"),
        "global::System.Half",
        castExpr(
          identifierType("global::System.Half"),
          decimalIntegerLiteral(0)
        )
      ),
      floatLikeArm(
        predefinedType("float"),
        "global::System.Single",
        numericLiteral({ base: "decimal", wholePart: "0", suffix: "f" })
      ),
      floatLikeArm(
        predefinedType("double"),
        "global::System.Double",
        numericLiteral({ base: "decimal", wholePart: "0", suffix: "d" })
      ),
      typedNonZeroArm(
        predefinedType("decimal"),
        numericLiteral({ base: "decimal", wholePart: "0", suffix: "m" })
      ),
      typedNonZeroArm(predefinedType("char"), charLiteral("\0")),
      makeSwitchArm({ kind: "discardPattern" }, booleanLiteral(true)),
    ],
  };
};

// ============================================================
// Runtime truthiness (AST-native)
// ============================================================

export const emitRuntimeTruthinessConditionAst = (
  emittedAst: CSharpExpressionAst,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  // Use a pattern variable to evaluate the operand exactly once, then apply JS-like truthiness.
  //
  // This is the airplane-grade fallback when we cannot trust inferredType:
  // - Never emit `x != null` for unknowns (silently miscompiles boxed value types like bool/int).
  // - Use runtime type checks to preserve semantics deterministically.
  const nextId = (context.tempVarId ?? 0) + 1;
  const ctxWithId: EmitterContext = { ...context, tempVarId: nextId };
  const alloc = allocateLocalName(`__tsonic_truthy_${nextId}`, ctxWithId);
  const tmp = alloc.emittedName;

  // Build: (operand is object __tmp && (__tmp switch { ... }))
  const isObjectExpr: CSharpExpressionAst = {
    kind: "isExpression",
    expression: wrapForIs(emittedAst),
    pattern: {
      kind: "declarationPattern",
      type: { kind: "predefinedType", keyword: "object" },
      designation: tmp,
    },
  };

  const switchExpr: CSharpExpressionAst = {
    kind: "parenthesizedExpression",
    expression: buildTruthySwitchAst(tmp),
  };

  return [
    {
      kind: "parenthesizedExpression",
      expression: {
        kind: "binaryExpression",
        operatorToken: "&&",
        left: isObjectExpr,
        right: switchExpr,
      },
    },
    alloc.context,
  ];
};

// ============================================================
// Type resolution helpers
// ============================================================

export const resolveLocalTypeAlias = (
  type: IrType,
  context: EmitterContext
): IrType => {
  let current = type;
  const visited = new Set<string>();

  while (current.kind === "referenceType") {
    const name = current.name;
    if (visited.has(name)) break;
    visited.add(name);

    const local = context.localTypes?.get(name);
    if (!local || local.kind !== "typeAlias") break;

    // If the alias is generic, substitute type arguments when provided.
    if (local.typeParameters.length > 0) {
      if (!current.typeArguments || current.typeArguments.length === 0) break;
      current = substituteTypeArgs(
        local.type,
        local.typeParameters,
        current.typeArguments
      );
      continue;
    }

    current = local.type;
  }

  return current;
};

export const getLiteralUnionBasePrimitive = (
  types: readonly IrType[]
): "string" | "number" | "boolean" | undefined => {
  let base: "string" | "number" | "boolean" | undefined;
  for (const t of types) {
    if (t.kind !== "literalType") return undefined;
    const v = t.value;
    const next =
      typeof v === "string"
        ? "string"
        : typeof v === "number"
          ? "number"
          : typeof v === "boolean"
            ? "boolean"
            : undefined;
    if (!next) return undefined;
    if (!base) base = next;
    else if (base !== next) return undefined;
  }
  return base;
};

/**
 * Whether a type is boolean.
 *
 * Used by callers that need a fast check (e.g., logical operator selection).
 */
export const isBooleanType = (type: IrType | undefined): boolean => {
  if (!type) return false;
  if (type.kind === "primitiveType") {
    return type.name === "boolean";
  }

  const coerced = coerceClrPrimitiveToPrimitiveType(type);
  return (
    !!coerced && coerced.kind === "primitiveType" && coerced.name === "boolean"
  );
};
