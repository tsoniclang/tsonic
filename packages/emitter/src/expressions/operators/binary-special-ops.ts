/**
 * Binary operator special-case handlers — `in` operator and `instanceof`.
 *
 * Extracted from binary-dispatch.ts to keep the main dispatcher under 500 LOC.
 * These handlers are called early in emitBinary before the generic binary path.
 */

import { IrExpression } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitTypeAst } from "../../type-emitter.js";
import {
  resolveTypeAlias,
  stripNullish,
  hasDeterministicPropertyMembership,
  matchesTypeofTag,
} from "../../core/semantic/type-resolution.js";
import {
  buildRuntimeUnionLayout,
  buildRuntimeUnionTypeAst,
  getCanonicalRuntimeUnionMembers,
} from "../../core/semantic/runtime-unions.js";
import {
  isSemanticUnion,
  willCarryAsRuntimeUnion,
} from "../../core/semantic/union-semantics.js";
import { normalizeInstanceofTargetType } from "../../core/semantic/instanceof-targets.js";
import { unwrapTransparentNarrowingTarget } from "../../core/semantic/transparent-expressions.js";
import { getMemberAccessNarrowKey } from "../../core/semantic/narrowing-keys.js";
import { currentNarrowedType } from "../../core/semantic/narrowing-builders.js";
import {
  resolveIdentifierCarrierStorageType,
  resolveDirectStorageExpressionAst,
  resolveDirectStorageExpressionType,
} from "../direct-storage-types.js";
import {
  booleanLiteral,
  identifierType,
} from "../../core/format/backend-ast/builders.js";
import {
  extractCalleeNameFromAst,
  stableTypeKeyFromAst,
  stripNullableTypeAst,
} from "../../core/format/backend-ast/utils.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";

const buildRuntimeUnionMemberCheck = (
  receiver: CSharpExpressionAst,
  memberNs: readonly number[],
  negate: boolean
): CSharpExpressionAst => {
  if (memberNs.length === 0) {
    return booleanLiteral(negate);
  }

  const checks = memberNs.map<CSharpExpressionAst>((memberN) => ({
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: receiver,
      memberName: `Is${memberN}`,
    },
    arguments: [],
  }));

  const combined = checks.reduce<CSharpExpressionAst | undefined>(
    (current, check) =>
      current
        ? {
            kind: "parenthesizedExpression",
            expression: {
              kind: "binaryExpression",
              operatorToken: "||",
              left: current,
              right: check,
            },
          }
        : check,
    undefined
  );

  const base = combined ?? booleanLiteral(false);
  return negate
    ? { kind: "prefixUnaryExpression", operatorToken: "!", operand: base }
    : base;
};

const resolveAlignedRuntimeCarrierMembers = (
  directStorageType: IrExpression["inferredType"] | undefined,
  effectiveType: IrExpression["inferredType"],
  context: EmitterContext
): [readonly IrExpression["inferredType"][], EmitterContext] | undefined => {
  if (!effectiveType) {
    const directLayoutOnly =
      directStorageType &&
      willCarryAsRuntimeUnion(directStorageType, context) &&
      buildRuntimeUnionLayout(directStorageType, context, emitTypeAst)[0];
    return directLayoutOnly ? [directLayoutOnly.members, context] : undefined;
  }

  const tryLayout = (
    type: IrExpression["inferredType"],
    currentContext: EmitterContext
  ) => {
    if (!type || !willCarryAsRuntimeUnion(type, currentContext)) {
      return undefined;
    }

    const [layout, layoutContext] = buildRuntimeUnionLayout(
      type,
      currentContext,
      emitTypeAst
    );
    return layout ? ([layout, layoutContext] as const) : undefined;
  };

  const directLayoutResult =
    directStorageType && tryLayout(directStorageType, context);
  const effectiveLayoutResult = tryLayout(effectiveType, context);

  if (!directLayoutResult) {
    return effectiveLayoutResult
      ? [effectiveLayoutResult[0].members, effectiveLayoutResult[1]]
      : undefined;
  }

  const [directLayout, directLayoutContext] = directLayoutResult;
  const [effectiveSurfaceAst, effectiveSurfaceContext] = emitTypeAst(
    effectiveType,
    directLayoutContext
  );
  const effectiveSurfaceKey = stableTypeKeyFromAst(
    stripNullableTypeAst(effectiveSurfaceAst)
  );
  const directLayoutKey = stableTypeKeyFromAst(
    buildRuntimeUnionTypeAst(directLayout)
  );

  if (directLayoutKey === effectiveSurfaceKey) {
    return [directLayout.members, effectiveSurfaceContext];
  }

  if (effectiveLayoutResult) {
    const [effectiveLayout, effectiveLayoutContext] = effectiveLayoutResult;
    const effectiveLayoutKey = stableTypeKeyFromAst(
      buildRuntimeUnionTypeAst(effectiveLayout)
    );
    if (effectiveLayoutKey === effectiveSurfaceKey) {
      return [effectiveLayout.members, effectiveLayoutContext];
    }
  }

  return [directLayout.members, effectiveSurfaceContext];
};

const tryExtractTypeofComparison = (
  expr: Extract<IrExpression, { kind: "binary" }>
):
  | {
      operand: IrExpression;
      tag: string;
      negate: boolean;
    }
  | undefined => {
  if (
    expr.operator !== "===" &&
    expr.operator !== "==" &&
    expr.operator !== "!==" &&
    expr.operator !== "!="
  ) {
    return undefined;
  }

  const extract = (
    left: IrExpression,
    right: IrExpression
  ): { operand: IrExpression; tag: string } | undefined => {
    if (left.kind !== "unary" || left.operator !== "typeof") {
      return undefined;
    }
    if (right.kind !== "literal" || typeof right.value !== "string") {
      return undefined;
    }
    return {
      operand: left.expression,
      tag: right.value,
    };
  };

  const direct =
    extract(expr.left, expr.right) ?? extract(expr.right, expr.left);
  if (!direct) {
    return undefined;
  }

  return {
    ...direct,
    negate: expr.operator === "!==" || expr.operator === "!=",
  };
};

/**
 * Emit a direct `typeof value === "tag"` comparison against a runtime-union
 * carrier as `value.IsN()` member checks.
 */
export const emitTypeofComparison = (
  expr: Extract<IrExpression, { kind: "binary" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const directGuard = tryExtractTypeofComparison(expr);
  if (!directGuard) {
    return undefined;
  }

  const operandType = directGuard.operand.inferredType;
  if (!operandType) {
    return undefined;
  }

  const target = unwrapTransparentNarrowingTarget(directGuard.operand);
  if (target?.kind === "memberAccess" && target.isOptional) {
    return undefined;
  }
  const bindingKey =
    target?.kind === "identifier"
      ? target.name
      : target
        ? getMemberAccessNarrowKey(target)
        : undefined;
  const effectiveType =
    (bindingKey
      ? currentNarrowedType(
          bindingKey,
          target?.inferredType ?? operandType,
          context
        )
      : undefined) ?? operandType;

  const [operandAst, operandContext] = emitExpressionAst(
    target ?? directGuard.operand,
    context
  );
  const directStorageType =
    target?.kind === "identifier"
      ? resolveIdentifierCarrierStorageType(target, operandContext)
      : resolveDirectStorageExpressionType(
          target ?? directGuard.operand,
          operandAst,
          operandContext
        );
  const runtimeCarrierAst =
    (directStorageType
      ? resolveDirectStorageExpressionAst(
          target ?? directGuard.operand,
          operandContext
        )
      : undefined) ?? operandAst;
  const alignedCarrierMembers = resolveAlignedRuntimeCarrierMembers(
    directStorageType,
    effectiveType,
    operandContext
  );
  if (!alignedCarrierMembers) {
    return undefined;
  }
  const [runtimeMembers, layoutContext] = alignedCarrierMembers;

  const matchingMemberNs = runtimeMembers.flatMap((member, index) =>
    member && matchesTypeofTag(member, directGuard.tag, layoutContext)
      ? [index + 1]
      : []
  );

  return [
    buildRuntimeUnionMemberCheck(
      runtimeCarrierAst,
      matchingMemberNs,
      directGuard.negate
    ),
    operandContext,
  ];
};

/**
 * Emit a `"prop" in x` expression — union narrowing or dictionary membership.
 */
export const emitInOperator = (
  expr: Extract<IrExpression, { kind: "binary" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  // LHS must be a string literal for deterministic lowering.
  if (expr.left.kind !== "literal" || typeof expr.left.value !== "string") {
    throw new Error(
      "ICE: Unsupported `in` operator form. Left-hand side must be a string literal."
    );
  }

  const rhsType = expr.right.inferredType;
  if (!rhsType) {
    throw new Error("ICE: `in` operator RHS missing inferredType.");
  }

  const [rhsAst, rhsCtx] = emitExpressionAst(expr.right, context);
  const resolvedRhs = resolveTypeAlias(stripNullish(rhsType), rhsCtx);

  // Semantic gate: only enter union dispatch if the RHS is semantically a union
  const runtimeMembers = isSemanticUnion(rhsType, rhsCtx)
    ? getCanonicalRuntimeUnionMembers(rhsType, rhsCtx)
    : undefined;
  const layoutContext = rhsCtx;

  // Union<T1..Tn>: `"error" in auth` -> auth.IsN() (where member N has the prop)
  if (runtimeMembers) {
    const propName = expr.left.value;
    const matchingMembers: number[] = [];
    const unresolvedMembers: string[] = [];

    for (let i = 0; i < runtimeMembers.length; i += 1) {
      const member = runtimeMembers[i];
      if (!member) continue;

      const hasMember = hasDeterministicPropertyMembership(
        member,
        propName,
        layoutContext
      );
      if (hasMember === true) {
        matchingMembers.push(i + 1);
        continue;
      }
      if (hasMember === undefined) {
        unresolvedMembers.push(JSON.stringify(member));
      }
    }

    if (unresolvedMembers.length > 0) {
      throw new Error(
        "ICE: Unable to deterministically resolve `in`-operator membership for one or more union members. " +
          `Property: '${propName}'. Members: ${unresolvedMembers.join(", ")}`
      );
    }

    if (matchingMembers.length === 0) {
      return [booleanLiteral(false), rhsCtx];
    }

    // Build IsN() call ASTs and chain with ||
    const checkAsts: CSharpExpressionAst[] = matchingMembers.map(
      (n): CSharpExpressionAst => ({
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: rhsAst,
          memberName: `Is${n}`,
        },
        arguments: [],
      })
    );

    const orChain = checkAsts.reduce(
      (left, right): CSharpExpressionAst => ({
        kind: "binaryExpression",
        operatorToken: "||",
        left,
        right,
      })
    );

    // Wrap multi-member OR chains in parens so they compose correctly
    // with surrounding operators (e.g., `(x.Is1() || x.Is2()) && ok`).
    const result: CSharpExpressionAst =
      checkAsts.length > 1
        ? { kind: "parenthesizedExpression", expression: orChain }
        : orChain;

    return [result, rhsCtx];
  }

  // Dictionary<K,V>: `"k" in dict` -> dict.ContainsKey("k")
  if (resolvedRhs.kind === "dictionaryType") {
    const keyType = stripNullish(resolvedRhs.keyType);
    const isStringKey =
      (keyType.kind === "primitiveType" && keyType.name === "string") ||
      (keyType.kind === "referenceType" && keyType.name === "string");

    if (!isStringKey) {
      throw new Error(
        "ICE: Unsupported `in` operator on dictionary with non-string keys."
      );
    }

    const [keyAst, keyCtx] = emitExpressionAst(expr.left, rhsCtx);
    const containsKeyAst: CSharpExpressionAst = {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: rhsAst,
        memberName: "ContainsKey",
      },
      arguments: [keyAst],
    };
    return [containsKeyAst, keyCtx];
  }

  const deterministicMembership = hasDeterministicPropertyMembership(
    rhsType,
    expr.left.value,
    rhsCtx
  );
  if (deterministicMembership !== undefined) {
    return [booleanLiteral(deterministicMembership), rhsCtx];
  }

  throw new Error(
    "ICE: Unsupported `in` operator. Only union shape guards and Dictionary<string, T> membership are supported."
  );
};

/**
 * Emit an `instanceof` expression as a C# `is` pattern expression.
 */
export const emitInstanceof = (
  expr: Extract<IrExpression, { kind: "binary" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [leftAst, leftContext] = emitExpressionAst(expr.left, context);
  const normalizedTargetType = normalizeInstanceofTargetType(
    expr.right.inferredType
  );
  let rightContext = leftContext;
  let rightText: string | undefined;

  if (normalizedTargetType) {
    const [rightTypeAst, nextContext] = emitTypeAst(
      normalizedTargetType,
      leftContext
    );
    rightText = extractCalleeNameFromAst({
      kind: "typeReferenceExpression",
      type: rightTypeAst,
    });
    rightContext = nextContext;
  } else {
    const [rightAst, nextContext] = emitExpressionAst(expr.right, leftContext);
    rightText = extractCalleeNameFromAst(rightAst);
    rightContext = nextContext;
  }
  const isExpr: CSharpExpressionAst = {
    kind: "isExpression",
    expression: leftAst,
    pattern: {
      kind: "typePattern",
      type: identifierType(rightText ?? "object"),
    },
  };
  return [isExpr, rightContext];
};
