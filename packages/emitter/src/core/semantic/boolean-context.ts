/**
 * Boolean-context emission (truthiness / ToBoolean)
 *
 * In TypeScript, any value can be used in a boolean context (truthy/falsy).
 * In C#, only boolean expressions are valid conditions (if/while/for/?:/!).
 *
 * This module provides a shared, deterministic lowering for boolean contexts.
 * All functions return typed CSharpExpressionAst nodes — no text bridging.
 *
 * IMPORTANT:
 * - This operates on IR + emitted AST; it must not import emitExpressionAst to avoid cycles.
 * - Callers provide an emit function.
 */

import type { IrExpression, IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { allocateLocalName } from "../format/local-names.js";
import { substituteTypeArgs } from "./type-resolution.js";
import type { CSharpExpressionAst } from "../format/backend-ast/types.js";

export type EmitExprAstFn = (
  expr: IrExpression,
  context: EmitterContext
) => [CSharpExpressionAst, EmitterContext];

const stripGlobalPrefix = (name: string): string =>
  name.startsWith("global::") ? name.slice("global::".length) : name;

/**
 * Coerce CLR primitive reference types (System.Boolean, System.Int32, ...) to IR primitiveType.
 *
 * This prevents boolean-context lowering from emitting `x != null` for CLR value types,
 * which is both semantically wrong and can silently miscompile (it compiles with boxing).
 */
const coerceClrPrimitiveToPrimitiveType = (
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
 * Check if an expression's inferred type is boolean.
 */
const isBooleanCondition = (expr: IrExpression): boolean => {
  const type = expr.inferredType;
  if (!type) return false;
  if (type.kind === "primitiveType") {
    return type.name === "boolean";
  }

  // Some CLR APIs (via bindings) surface as referenceType with a resolved CLR primitive
  // (e.g. System.Boolean). Treat those as booleans for C# conditions.
  const coerced = coerceClrPrimitiveToPrimitiveType(type);
  return (
    !!coerced && coerced.kind === "primitiveType" && coerced.name === "boolean"
  );
};

/**
 * Expressions that are always boolean in JS/TS, even if the IR is missing inferredType.
 *
 * This makes boolean-context emission robust: comparisons and `!expr` are already valid
 * C# conditions and should not be rewritten to `!= null` fallbacks.
 */
const isInherentlyBooleanExpression = (expr: IrExpression): boolean => {
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
const wrapForIs = (ast: CSharpExpressionAst): CSharpExpressionAst => {
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

const identifierExpr = (name: string): CSharpExpressionAst => ({
  kind: "identifierExpression",
  identifier: name,
});

const literalExpr = (text: string): CSharpExpressionAst => ({
  kind: "literalExpression",
  text,
});

/**
 * Build the canonical JS-like truthiness switch expression text for a temp variable.
 * This is a constant template that only depends on the temp variable name.
 */
const buildTruthySwitchText = (tmp: string): string =>
  `${tmp} switch { ` +
  `bool => (bool)${tmp}, ` +
  `string => ((string)${tmp}).Length != 0, ` +
  `sbyte => (sbyte)${tmp} != 0, ` +
  `byte => (byte)${tmp} != 0, ` +
  `short => (short)${tmp} != 0, ` +
  `ushort => (ushort)${tmp} != 0, ` +
  `int => (int)${tmp} != 0, ` +
  `uint => (uint)${tmp} != 0U, ` +
  `long => (long)${tmp} != 0L, ` +
  `ulong => (ulong)${tmp} != 0UL, ` +
  `nint => (nint)${tmp} != 0, ` +
  `nuint => (nuint)${tmp} != 0, ` +
  `global::System.Int128 => (global::System.Int128)${tmp} != 0, ` +
  `global::System.UInt128 => (global::System.UInt128)${tmp} != 0, ` +
  `global::System.Half => ((global::System.Half)${tmp}) != (global::System.Half)0 && !global::System.Half.IsNaN((global::System.Half)${tmp}), ` +
  `float => ((float)${tmp}) != 0f && !float.IsNaN((float)${tmp}), ` +
  `double => ((double)${tmp}) != 0d && !double.IsNaN((double)${tmp}), ` +
  `decimal => (decimal)${tmp} != 0m, ` +
  `char => (char)${tmp} != '\\0', ` +
  `_ => true }`;

// ============================================================
// Runtime truthiness (AST-native)
// ============================================================

const emitRuntimeTruthinessConditionAst = (
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
    expression: literalExpr(buildTruthySwitchText(tmp)),
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

const resolveLocalTypeAlias = (
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

const isNullishType = (type: IrType): boolean =>
  type.kind === "primitiveType" &&
  (type.name === "null" || type.name === "undefined");

const getLiteralUnionBasePrimitive = (
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

// ============================================================
// Union truthiness (AST-native)
// ============================================================

const emitUnionTruthinessConditionAst = (
  expr: IrExpression,
  emittedAst: CSharpExpressionAst,
  unionType: Extract<IrType, { kind: "unionType" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  // Align boolean-context emission with union type emission:
  // - (T | null | undefined) behaves like a nullable (falsy when nullish)
  // - literal unions behave like their primitive base at runtime
  // - 2-8 unions emit as global::Tsonic.Runtime.Union<T1..Tn>, which requires per-variant truthiness

  const nonNullTypes = unionType.types.filter((t) => !isNullishType(t));
  const hasNullish = nonNullTypes.length !== unionType.types.length;

  const literalBase = getLiteralUnionBasePrimitive(nonNullTypes);
  if (literalBase) {
    const baseType: IrType = {
      kind: "primitiveType",
      name: literalBase,
    } as IrType;
    if (!hasNullish) {
      return toBooleanConditionAst(
        { ...expr, inferredType: baseType },
        emittedAst,
        context
      );
    }

    // Nullable literal union (e.g. "a" | "b" | null) → value is falsy when nullish.
    const nextId = (context.tempVarId ?? 0) + 1;
    const ctxWithId: EmitterContext = { ...context, tempVarId: nextId };
    const alloc = allocateLocalName(
      `__tsonic_truthy_nullable_${nextId}`,
      ctxWithId
    );
    const tmp = alloc.emittedName;

    const [innerCondAst, innerCtx] = toBooleanConditionAst(
      {
        kind: "identifier",
        name: tmp,
        inferredType: baseType,
      } as IrExpression,
      identifierExpr(tmp),
      alloc.context
    );
    const emittedNonNull =
      literalBase === "string"
        ? "string"
        : literalBase === "number"
          ? "double"
          : "bool";
    // Build: (operand is Type tmp && innerCond)
    return [
      {
        kind: "parenthesizedExpression",
        expression: {
          kind: "binaryExpression",
          operatorToken: "&&",
          left: {
            kind: "isExpression",
            expression: wrapForIs(emittedAst),
            pattern: {
              kind: "declarationPattern",
              type: { kind: "predefinedType", keyword: emittedNonNull },
              designation: tmp,
            },
          },
          right: innerCondAst,
        },
      },
      innerCtx,
    ];
  }

  // Nullable union: (T | null | undefined) → treat as `T?` truthiness.
  if (hasNullish && nonNullTypes.length === 1) {
    const nonNull = nonNullTypes[0];
    if (!nonNull) return [literalExpr("false"), context];

    // For non-primitive nullable unions (e.g. `T[] | undefined`, `SomeRef | null`),
    // emit truthiness directly against the operand with non-null inferred type.
    // This avoids nested nullable pattern variables while preserving exact semantics.
    if (nonNull.kind !== "primitiveType") {
      return toBooleanConditionAst(
        { ...expr, inferredType: nonNull },
        emittedAst,
        context
      );
    }

    const nextId = (context.tempVarId ?? 0) + 1;
    const ctxWithId: EmitterContext = { ...context, tempVarId: nextId };
    const alloc = allocateLocalName(
      `__tsonic_truthy_nullable_${nextId}`,
      ctxWithId
    );
    const tmp = alloc.emittedName;

    // Pattern-match the non-null value into a strongly-typed temp and apply truthiness to it.
    // This handles both nullable value types (int?) and nullable reference types (string?).
    const [innerCondAst, innerCtx] = toBooleanConditionAst(
      {
        kind: "identifier",
        name: tmp,
        inferredType: nonNull,
      } as IrExpression,
      identifierExpr(tmp),
      alloc.context
    );
    const emittedNonNull =
      nonNull.name === "number"
        ? "double"
        : nonNull.name === "int"
          ? "int"
          : nonNull.name === "string"
            ? "string"
            : nonNull.name === "boolean"
              ? "bool"
              : nonNull.name === "char"
                ? "char"
                : "object";
    // Build: (operand is Type tmp && innerCond)
    return [
      {
        kind: "parenthesizedExpression",
        expression: {
          kind: "binaryExpression",
          operatorToken: "&&",
          left: {
            kind: "isExpression",
            expression: wrapForIs(emittedAst),
            pattern: {
              kind: "declarationPattern",
              type: { kind: "predefinedType", keyword: emittedNonNull },
              designation: tmp,
            },
          },
          right: innerCondAst,
        },
      },
      innerCtx,
    ];
  }

  // 2-8 unions use runtime Union<T1..Tn>. We must inspect the active variant.
  if (unionType.types.length >= 2 && unionType.types.length <= 8) {
    const nextId = (context.tempVarId ?? 0) + 1;
    const ctxWithId: EmitterContext = { ...context, tempVarId: nextId };
    const alloc = allocateLocalName(
      `__tsonic_truthy_union_${nextId}`,
      ctxWithId
    );
    const u = alloc.emittedName;

    // Build per-member truthiness ASTs
    let chainCtx = alloc.context;
    const branchAsts: CSharpExpressionAst[] = [];

    for (let i = 0; i < unionType.types.length; i++) {
      const memberN = i + 1;
      const memberType = unionType.types[i];
      if (!memberType || isNullishType(memberType)) {
        branchAsts.push(literalExpr("false"));
        continue;
      }

      const memberEmittedAst: CSharpExpressionAst = {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: identifierExpr(u),
          memberName: `As${memberN}`,
        },
        arguments: [],
      };

      const [memberCondAst, memberCtx] = toBooleanConditionAst(
        {
          kind: "identifier",
          name: `${u}__${memberN}`,
          inferredType: memberType,
        } as IrExpression,
        memberEmittedAst,
        chainCtx
      );
      branchAsts.push(memberCondAst);
      chainCtx = memberCtx;
    }

    // Build nested conditional chain: u.Is1() ? (cond1) : u.Is2() ? (cond2) : ...
    const buildChain = (start: number): CSharpExpressionAst => {
      const last = branchAsts[branchAsts.length - 1];
      if (start === branchAsts.length - 1) {
        return last ?? literalExpr("false");
      }
      const branch = branchAsts[start];
      return {
        kind: "conditionalExpression",
        condition: {
          kind: "invocationExpression",
          expression: {
            kind: "memberAccessExpression",
            expression: identifierExpr(u),
            memberName: `Is${start + 1}`,
          },
          arguments: [],
        },
        whenTrue: {
          kind: "parenthesizedExpression",
          expression: branch ?? literalExpr("false"),
        },
        whenFalse: {
          kind: "parenthesizedExpression",
          expression: buildChain(start + 1),
        },
      };
    };

    const chainAst = buildChain(0);

    // Build: (operand is var u && u is not null && (chain))
    return [
      {
        kind: "parenthesizedExpression",
        expression: {
          kind: "binaryExpression",
          operatorToken: "&&",
          left: {
            kind: "binaryExpression",
            operatorToken: "&&",
            left: {
              kind: "isExpression",
              expression: wrapForIs(emittedAst),
              pattern: { kind: "varPattern", designation: u },
            },
            right: {
              kind: "isExpression",
              expression: identifierExpr(u),
              pattern: {
                kind: "negatedPattern",
                pattern: {
                  kind: "constantPattern",
                  expression: literalExpr("null"),
                },
              },
            },
          },
          right: {
            kind: "parenthesizedExpression",
            expression: chainAst,
          },
        },
      },
      chainCtx,
    ];
  }

  // Fallback for unions >8 (emitted as object): runtime truthiness matches JS semantics.
  return emitRuntimeTruthinessConditionAst(emittedAst, context);
};

// ============================================================
// Main boolean-condition lowering (AST-native)
// ============================================================

/**
 * Convert an expression to a valid C# boolean condition, returning a typed AST node.
 *
 * Rules (deterministic):
 * - Booleans: use as-is
 * - Reference types (objects, arrays, dictionaries, unions, ...): runtime truthiness
 * - Strings: `!string.IsNullOrEmpty(expr)`
 * - Numbers: JS truthiness check: false iff 0 or NaN
 * - int: `expr != 0`
 * - char: `expr != '\0'`
 * - null/undefined literals: `false`
 */
export const toBooleanConditionAst = (
  expr: IrExpression,
  emittedAst: CSharpExpressionAst,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const inferredType = expr.inferredType;
  const resolved = inferredType
    ? resolveLocalTypeAlias(
        coerceClrPrimitiveToPrimitiveType(inferredType) ?? inferredType,
        context
      )
    : undefined;
  const type = resolved;

  // Literal truthiness can be fully resolved without re-evaluating anything.
  if (expr.kind === "literal") {
    if (expr.value === null || expr.value === undefined) {
      return [literalExpr("false"), context];
    }
    if (typeof expr.value === "boolean") {
      return [literalExpr(expr.value ? "true" : "false"), context];
    }
    if (typeof expr.value === "number") {
      return [literalExpr(expr.value === 0 ? "false" : "true"), context];
    }
    if (typeof expr.value === "string") {
      return [literalExpr(expr.value.length === 0 ? "false" : "true"), context];
    }
  }

  // If already boolean, use as-is
  if (isBooleanCondition(expr)) {
    return [emittedAst, context];
  }

  // If we can prove from syntax alone that this is a boolean expression, use as-is.
  if (isInherentlyBooleanExpression(expr)) {
    return [emittedAst, context];
  }

  // Unknown/any/missing type: use a safe runtime truthiness check instead of `!= null`,
  // which can silently miscompile boxed value types (e.g., bool).
  if (!type || type.kind === "unknownType" || type.kind === "anyType") {
    return emitRuntimeTruthinessConditionAst(emittedAst, context);
  }

  if (type.kind === "unionType") {
    return emitUnionTruthinessConditionAst(expr, emittedAst, type, context);
  }

  // Non-primitive types in TS can still map to CLR value types (e.g. `long`, `System.Boolean` wrappers).
  // Never emit `x != null` here: it can silently miscompile boxed value types (always true).
  // Use canonical runtime truthiness instead.
  if (type.kind !== "primitiveType") {
    return emitRuntimeTruthinessConditionAst(emittedAst, context);
  }

  // For primitives that are not boolean
  if (type.kind === "primitiveType") {
    switch (type.name) {
      case "null":
      case "undefined":
        return [literalExpr("false"), context];

      case "string":
        // !string.IsNullOrEmpty(expr)
        return [
          {
            kind: "parenthesizedExpression",
            expression: {
              kind: "prefixUnaryExpression",
              operatorToken: "!",
              operand: {
                kind: "invocationExpression",
                expression: {
                  kind: "memberAccessExpression",
                  expression: literalExpr("string"),
                  memberName: "IsNullOrEmpty",
                },
                arguments: [emittedAst],
              },
            },
          },
          context,
        ];

      case "int":
        // expr != 0
        return [
          {
            kind: "parenthesizedExpression",
            expression: {
              kind: "binaryExpression",
              operatorToken: "!=",
              left: emittedAst,
              right: literalExpr("0"),
            },
          },
          context,
        ];

      case "char":
        // expr != '\0'
        return [
          {
            kind: "parenthesizedExpression",
            expression: {
              kind: "binaryExpression",
              operatorToken: "!=",
              left: emittedAst,
              right: literalExpr("'\\0'"),
            },
          },
          context,
        ];

      case "number": {
        // JS truthiness for numbers: falsy iff 0 or NaN.
        // Use a pattern var to avoid evaluating the expression twice.
        // Build: (operand is double __tmp && __tmp != 0 && !double.IsNaN(__tmp))
        const nextId = (context.tempVarId ?? 0) + 1;
        const ctxWithId: EmitterContext = { ...context, tempVarId: nextId };
        const numAlloc = allocateLocalName(
          `__tsonic_truthy_num_${nextId}`,
          ctxWithId
        );
        const tmp = numAlloc.emittedName;
        return [
          {
            kind: "parenthesizedExpression",
            expression: {
              kind: "binaryExpression",
              operatorToken: "&&",
              left: {
                kind: "isExpression",
                expression: wrapForIs(emittedAst),
                pattern: {
                  kind: "declarationPattern",
                  type: { kind: "predefinedType", keyword: "double" },
                  designation: tmp,
                },
              },
              right: {
                kind: "binaryExpression",
                operatorToken: "&&",
                left: {
                  kind: "binaryExpression",
                  operatorToken: "!=",
                  left: identifierExpr(tmp),
                  right: literalExpr("0"),
                },
                right: {
                  kind: "prefixUnaryExpression",
                  operatorToken: "!",
                  operand: {
                    kind: "invocationExpression",
                    expression: {
                      kind: "memberAccessExpression",
                      expression: literalExpr("double"),
                      memberName: "IsNaN",
                    },
                    arguments: [identifierExpr(tmp)],
                  },
                },
              },
            },
          },
          numAlloc.context,
        ];
      }

      case "boolean":
        return [emittedAst, context];
    }
  }

  return [emittedAst, context];
};

/**
 * Emit a boolean-context expression as a typed AST node.
 *
 * Special-cases logical &&/|| into proper binaryExpression AST nodes
 * with printer-handled parenthesization.
 */
export const emitBooleanConditionAst = (
  expr: IrExpression,
  emitExprAst: EmitExprAstFn,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  if (
    expr.kind === "logical" &&
    (expr.operator === "&&" || expr.operator === "||")
  ) {
    const [leftAst, leftCtx] = emitBooleanConditionAst(
      expr.left,
      emitExprAst,
      context
    );
    const [rightAst, rightCtx] = emitBooleanConditionAst(
      expr.right,
      emitExprAst,
      leftCtx
    );

    return [
      {
        kind: "binaryExpression",
        operatorToken: expr.operator,
        left: leftAst,
        right: rightAst,
      },
      rightCtx,
    ];
  }

  const [exprAst, exprCtx] = emitExprAst(expr, context);
  return toBooleanConditionAst(expr, exprAst, exprCtx);
};

/**
 * Whether a type is boolean.
 *
 * Used by callers that need a fast check (e.g., logical operator selection).
 */
export const isBooleanType = (type: IrType | undefined): boolean => {
  return !!type && type.kind === "primitiveType" && type.name === "boolean";
};
