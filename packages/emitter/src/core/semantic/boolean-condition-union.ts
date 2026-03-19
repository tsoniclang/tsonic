/**
 * Union truthiness emission for boolean conditions (AST-native).
 *
 * Handles the per-variant truthiness logic for union types:
 * - (T | null | undefined) nullable unions
 * - literal unions (e.g., "a" | "b")
 * - 2-8 member runtime Union<T1..Tn>
 * - fallback for unions >8 (emitted as object)
 */

import type { IrExpression, IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { allocateLocalName } from "../format/local-names.js";
import {
  isRuntimeNullishType,
  splitRuntimeNullishUnionMembers,
} from "./type-resolution.js";
import { getCanonicalRuntimeUnionMembers } from "./runtime-unions.js";
import {
  booleanLiteral,
  nullLiteral,
} from "../format/backend-ast/builders.js";
import type { CSharpExpressionAst } from "../format/backend-ast/types.js";
import {
  emitRuntimeTruthinessConditionAst,
  getLiteralUnionBasePrimitive,
  identifierExpr,
  wrapForIs,
} from "./truthiness-evaluation.js";
import type { toBooleanConditionAst } from "./boolean-condition-main.js";

type ToBooleanConditionAstFn = typeof toBooleanConditionAst;

// ============================================================
// Union truthiness (AST-native)
// ============================================================

export const emitUnionTruthinessConditionAst = (
  expr: IrExpression,
  emittedAst: CSharpExpressionAst,
  unionType: Extract<IrType, { kind: "unionType" }>,
  context: EmitterContext,
  toBooleanConditionAstFn: ToBooleanConditionAstFn
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
      return toBooleanConditionAstFn(
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

    const [innerCondAst, innerCtx] = toBooleanConditionAstFn(
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
    const [innerCondAst, innerCtx] = toBooleanConditionAstFn(
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

      const [memberCondAst, memberCtx] = toBooleanConditionAstFn(
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
