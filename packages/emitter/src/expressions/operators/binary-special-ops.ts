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
  nullLiteral,
} from "../../core/format/backend-ast/builders.js";
import {
  extractCalleeNameFromAst,
} from "../../core/format/backend-ast/utils.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";
type RuntimeUnionLayout = NonNullable<
  ReturnType<typeof buildRuntimeUnionLayout>[0]
>;

const buildRuntimeUnionMemberOrChain = (
  receiver: CSharpExpressionAst,
  memberNs: readonly number[]
): CSharpExpressionAst => {
  if (memberNs.length === 0) {
    return booleanLiteral(false);
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

  return combined ?? booleanLiteral(false);
};

const resolveAlignedRuntimeCarrierMembers = (
  directStorageType: IrExpression["inferredType"] | undefined,
  effectiveType: IrExpression["inferredType"],
  context: EmitterContext
): [RuntimeUnionLayout, EmitterContext] | undefined => {
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

  if (directStorageType) {
    const effectiveLayoutResult = effectiveType
      ? tryLayout(effectiveType, context)
      : undefined;
    if (effectiveLayoutResult) {
      return [effectiveLayoutResult[0], effectiveLayoutResult[1]];
    }

    const directLayoutResult = tryLayout(directStorageType, context);
    if (directLayoutResult) {
      return [directLayoutResult[0], directLayoutResult[1]];
    }
  }

  if (!effectiveType) {
    return undefined;
  }

  const effectiveLayoutResult = tryLayout(effectiveType, context);
  return effectiveLayoutResult
    ? [effectiveLayoutResult[0], effectiveLayoutResult[1]]
    : undefined;
};

const buildRuntimeUnionMemberCheck = (opts: {
  readonly receiver: CSharpExpressionAst;
  readonly memberNs: readonly number[];
  readonly negate: boolean;
  readonly context: EmitterContext;
}): [CSharpExpressionAst, EmitterContext] => {
  const { receiver, memberNs, negate, context } = opts;

  if (memberNs.length === 0) {
    return [booleanLiteral(negate), context];
  }

  const guardedCheck: CSharpExpressionAst = {
    kind: "binaryExpression",
    operatorToken: "&&",
    left: {
      kind: "binaryExpression",
      operatorToken: "!=",
      left: {
        kind: "parenthesizedExpression",
        expression: {
          kind: "castExpression",
          type: identifierType("global::System.Object"),
          expression: {
            kind: "parenthesizedExpression",
            expression: receiver,
          },
        },
      },
      right: nullLiteral(),
    },
    right: buildRuntimeUnionMemberOrChain(receiver, memberNs),
  };

  return [
    negate
      ? {
          kind: "prefixUnaryExpression",
          operatorToken: "!",
          operand: {
            kind: "parenthesizedExpression",
            expression: guardedCheck,
          },
        }
      : guardedCheck,
    context,
  ];
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
      ? (operandContext.localValueTypes?.get(target.name) ??
        resolveIdentifierCarrierStorageType(target, operandContext))
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
  const [runtimeLayout, layoutContext] = alignedCarrierMembers;
  const runtimeMembers = runtimeLayout.members;

  const matchingMemberNs = runtimeMembers.flatMap((member, index) =>
    member && matchesTypeofTag(member, directGuard.tag, layoutContext)
      ? [index + 1]
      : []
  );

  return buildRuntimeUnionMemberCheck({
    receiver: runtimeCarrierAst,
    memberNs: matchingMemberNs,
    negate: directGuard.negate,
    context: layoutContext,
  });
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
