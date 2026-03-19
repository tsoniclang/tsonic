/**
 * Boolean-condition emission (toBooleanConditionAst, emitBooleanConditionAst)
 *
 * In TypeScript, any value can be used in a boolean context (truthy/falsy).
 * In C#, only boolean expressions are valid conditions (if/while/for/?:/!).
 *
 * This module provides the main boolean-condition lowering functions
 * that dispatch to appropriate truthiness checks based on type.
 *
 * IMPORTANT:
 * - This operates on IR + emitted AST; it must not import emitExpressionAst to avoid cycles.
 * - Callers provide an emit function.
 */

import type { IrExpression, IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { allocateLocalName } from "../format/local-names.js";
import { resolveEffectiveExpressionType } from "./narrowed-expression-types.js";
import {
  isRuntimeNullishType,
  splitRuntimeNullishUnionMembers,
} from "./type-resolution.js";
import { applyLogicalOperandNarrowing } from "./condition-branch-narrowing.js";
import { getCanonicalRuntimeUnionMembers } from "./runtime-unions.js";
import {
  booleanLiteral,
  charLiteral,
  decimalIntegerLiteral,
  nullLiteral,
} from "../format/backend-ast/builders.js";
import type { CSharpExpressionAst } from "../format/backend-ast/types.js";
import {
  coerceClrPrimitiveToPrimitiveType,
  emitRuntimeTruthinessConditionAst,
  getLiteralUnionBasePrimitive,
  isBooleanType,
  identifierExpr,
  isInherentlyBooleanExpression,
  predefinedType,
  resolveLocalTypeAlias,
  typeReferenceExpr,
  wrapForIs,
} from "./truthiness-evaluation.js";

export type EmitExprAstFn = (
  expr: IrExpression,
  context: EmitterContext
) => [CSharpExpressionAst, EmitterContext];

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

  const runtimeNullishSplit = splitRuntimeNullishUnionMembers(unionType);
  const nonNullTypes =
    runtimeNullishSplit?.nonNullishMembers ?? unionType.types;
  const hasNullish = runtimeNullishSplit?.hasRuntimeNullish ?? false;

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
    if (!nonNull) return [booleanLiteral(false), context];

    // For non-primitive nullable unions (e.g. `T[] | undefined`, `SomeRef | null`),
    // emit truthiness directly against the operand with non-null inferred type.
    // This avoids nested nullable pattern variables while preserving exact semantics.
    if (nonNull.kind !== "primitiveType") {
      return emitRuntimeTruthinessConditionAst(emittedAst, context);
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
  const runtimeMembers = getCanonicalRuntimeUnionMembers(unionType, context);
  if (runtimeMembers) {
    const nextId = (context.tempVarId ?? 0) + 1;
    const ctxWithId: EmitterContext = {
      ...context,
      tempVarId: nextId,
    };
    const alloc = allocateLocalName(
      `__tsonic_truthy_union_${nextId}`,
      ctxWithId
    );
    const u = alloc.emittedName;

    // Build per-member truthiness ASTs
    let chainCtx = alloc.context;
    const branchAsts: CSharpExpressionAst[] = [];

    for (let i = 0; i < runtimeMembers.length; i++) {
      const memberN = i + 1;
      const memberType = runtimeMembers[i];
      if (!memberType || isRuntimeNullishType(memberType)) {
        branchAsts.push(booleanLiteral(false));
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
        return last ?? booleanLiteral(false);
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
          expression: branch ?? booleanLiteral(false),
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
                  expression: nullLiteral(),
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
  const inferredType = resolveEffectiveExpressionType(expr, context);
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
      return [booleanLiteral(false), context];
    }
    if (typeof expr.value === "boolean") {
      return [booleanLiteral(expr.value), context];
    }
    if (typeof expr.value === "number") {
      return [booleanLiteral(expr.value !== 0), context];
    }
    if (typeof expr.value === "string") {
      return [booleanLiteral(expr.value.length !== 0), context];
    }
  }

  // If already boolean, use as-is
  if (isBooleanType(type)) {
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
        return [booleanLiteral(false), context];

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
                  expression: typeReferenceExpr(predefinedType("string")),
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
              right: decimalIntegerLiteral(0),
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
              right: charLiteral("\0"),
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
                  right: decimalIntegerLiteral(0),
                },
                right: {
                  kind: "prefixUnaryExpression",
                  operatorToken: "!",
                  operand: {
                    kind: "invocationExpression",
                    expression: {
                      kind: "memberAccessExpression",
                      expression: typeReferenceExpr(predefinedType("double")),
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
    const rightBaseContext = applyLogicalOperandNarrowing(
      expr.left,
      expr.operator,
      leftCtx,
      emitExprAst
    );
    const [rightAst, rightCtx] = emitBooleanConditionAst(
      expr.right,
      emitExprAst,
      rightBaseContext
    );
    const finalContext: EmitterContext = {
      ...rightCtx,
      tempVarId: Math.max(leftCtx.tempVarId ?? 0, rightCtx.tempVarId ?? 0),
      usings: new Set([...(leftCtx.usings ?? []), ...(rightCtx.usings ?? [])]),
      narrowedBindings: leftCtx.narrowedBindings,
    };

    return [
      {
        kind: "binaryExpression",
        operatorToken: expr.operator,
        left: leftAst,
        right: rightAst,
      },
      finalContext,
    ];
  }

  const [exprAst, exprCtx] = emitExprAst(expr, context);
  return toBooleanConditionAst(expr, exprAst, exprCtx);
};
