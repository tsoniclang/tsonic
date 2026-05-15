/**
 * Binary operator special-case handlers for closed-carrier runtime tests.
 *
 * Extracted from binary-dispatch.ts to keep the main dispatcher under 500 LOC.
 * These handlers are called early in emitBinary before the generic binary path.
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitTypeAst } from "../../type-emitter.js";
import {
  findExactRuntimeUnionMemberIndices,
  findRuntimeUnionMemberIndices,
  findRuntimeUnionInstanceofMemberIndices,
} from "../../core/semantic/runtime-union-matching.js";
import { normalizeInstanceofTargetType } from "../../core/semantic/instanceof-targets.js";
import {
  buildRuntimeUnionLayout,
  getCanonicalRuntimeUnionMembers,
} from "../../core/semantic/runtime-unions.js";
import { unwrapTransparentNarrowingTarget } from "../../core/semantic/transparent-expressions.js";
import { getMemberAccessNarrowKey } from "../../core/semantic/narrowing-keys.js";
import { currentNarrowedType } from "../../core/semantic/narrowing-builders.js";
import { resolveAlignedRuntimeUnionMembers } from "../../core/semantic/narrowed-union-resolution.js";
import {
  resolveIdentifierRuntimeCarrierType,
  resolveRuntimeCarrierExpressionAst,
  resolveRuntimeCarrierIrType,
  resolveDirectStorageExpressionType,
} from "../direct-storage-types.js";
import {
  booleanLiteral,
  identifierType,
  nullLiteral,
} from "../../core/format/backend-ast/builders.js";
import { extractCalleeNameFromAst } from "../../core/format/backend-ast/utils.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";
import {
  matchesTypeofTag,
  resolveTypeAlias,
  stripNullish,
} from "../../core/semantic/type-resolution.js";
import { isBroadObjectSlotType } from "../../core/semantic/broad-object-types.js";

const NUMERIC_TYPEOF_PATTERN_NAMES = [
  "byte",
  "sbyte",
  "short",
  "ushort",
  "int",
  "uint",
  "long",
  "ulong",
  "float",
  "double",
  "decimal",
] as const;

const mayProduceNullableValue = (ast: CSharpExpressionAst): boolean => {
  switch (ast.kind) {
    case "conditionalMemberAccessExpression":
    case "conditionalElementAccessExpression":
      return true;
    case "conditionalExpression":
      return (
        mayProduceNullableValue(ast.whenTrue) ||
        mayProduceNullableValue(ast.whenFalse)
      );
    case "memberAccessExpression":
    case "elementAccessExpression":
    case "invocationExpression":
      return mayProduceNullableValue(ast.expression);
    case "parenthesizedExpression":
    case "castExpression":
    case "asExpression":
    case "suppressNullableWarningExpression":
      return mayProduceNullableValue(ast.expression);
    default:
      return false;
  }
};

const buildRuntimeUnionMemberOrChain = (
  receiver: CSharpExpressionAst,
  memberNs: readonly number[]
): CSharpExpressionAst => {
  if (memberNs.length === 0) {
    return booleanLiteral(false);
  }

  const receiverCanBeNullable = mayProduceNullableValue(receiver);
  const checks = memberNs.map<CSharpExpressionAst>((memberN) => {
    const check: CSharpExpressionAst = {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: receiver,
        memberName: `Is${memberN}`,
      },
      arguments: [],
    };
    return receiverCanBeNullable
      ? {
          kind: "binaryExpression",
          operatorToken: "==",
          left: check,
          right: booleanLiteral(true),
        }
      : check;
  });

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

const tryExtractRuntimeUnionMemberProjection = (
  ast: CSharpExpressionAst
):
  | {
      readonly receiver: CSharpExpressionAst;
      readonly memberN: number;
    }
  | undefined => {
  let current = ast;
  while (
    current.kind === "parenthesizedExpression" ||
    current.kind === "castExpression" ||
    current.kind === "asExpression"
  ) {
    current = current.expression;
  }

  if (
    current.kind !== "invocationExpression" ||
    current.arguments.length !== 0 ||
    current.expression.kind !== "memberAccessExpression"
  ) {
    return undefined;
  }

  const memberMatch = /^As([1-9][0-9]*)$/.exec(current.expression.memberName);
  if (!memberMatch) {
    return undefined;
  }

  const memberN = Number(memberMatch[1]);
  return Number.isInteger(memberN)
    ? {
        receiver: current.expression.expression,
        memberN,
      }
    : undefined;
};

const runtimeUnionMemberMatchesInstanceofTarget = (
  member: IrExpression["inferredType"],
  targetType: IrExpression["inferredType"],
  context: EmitterContext
): boolean =>
  !!member &&
  !!targetType &&
  (findExactRuntimeUnionMemberIndices([member], targetType, context).length >
    0 ||
    findRuntimeUnionMemberIndices([member], targetType, context).length > 0 ||
    findRuntimeUnionInstanceofMemberIndices([member], targetType, context)
      .length > 0);

const getRuntimeUnionCarrierMembers = (
  candidate: IrType | undefined,
  context: EmitterContext
): readonly IrType[] | undefined => {
  if (!candidate) {
    return undefined;
  }

  return (
    getCanonicalRuntimeUnionMembers(candidate, context) ??
    buildRuntimeUnionLayout(candidate, context, emitTypeAst)[0]?.members
  );
};

const selectRuntimeUnionCarrierType = (
  context: EmitterContext,
  ...candidates: (IrType | undefined)[]
): IrType | undefined =>
  candidates.find(
    (candidate): candidate is IrType =>
      candidate !== undefined &&
      getRuntimeUnionCarrierMembers(candidate, context) !== undefined
  );

const parenthesize = (
  expression: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "parenthesizedExpression",
  expression,
});

const buildTypePatternCheck = (
  value: CSharpExpressionAst,
  typeName: string
): CSharpExpressionAst => ({
  kind: "isExpression",
  expression: value,
  pattern: {
    kind: "typePattern",
    type: identifierType(typeName),
  },
});

const buildOrChain = (
  expressions: readonly CSharpExpressionAst[]
): CSharpExpressionAst =>
  expressions.reduce<CSharpExpressionAst | undefined>(
    (current, expression) =>
      current
        ? parenthesize({
            kind: "binaryExpression",
            operatorToken: "||",
            left: current,
            right: expression,
          })
        : expression,
    undefined
  ) ?? booleanLiteral(false);

const buildBroadTypeofCheck = (
  value: CSharpExpressionAst,
  tag: string,
  negate: boolean
): CSharpExpressionAst | undefined => {
  const numericCheck = buildOrChain(
    NUMERIC_TYPEOF_PATTERN_NAMES.map((name) =>
      buildTypePatternCheck(value, name)
    )
  );
  const stringCheck = buildTypePatternCheck(value, "string");
  const booleanCheck = buildTypePatternCheck(value, "bool");
  const functionCheck = buildTypePatternCheck(value, "global::System.Delegate");
  const nullCheck: CSharpExpressionAst = {
    kind: "binaryExpression",
    operatorToken: "==",
    left: parenthesize({
      kind: "castExpression",
      type: identifierType("global::System.Object"),
      expression: parenthesize(value),
    }),
    right: nullLiteral(),
  };

  const positive = (() => {
    switch (tag) {
      case "string":
        return stringCheck;
      case "number":
        return numericCheck;
      case "boolean":
        return booleanCheck;
      case "function":
        return functionCheck;
      case "undefined":
        return nullCheck;
      case "object":
        return parenthesize({
          kind: "binaryExpression",
          operatorToken: "&&",
          left: {
            kind: "prefixUnaryExpression",
            operatorToken: "!",
            operand: parenthesize(nullCheck),
          },
          right: parenthesize({
            kind: "binaryExpression",
            operatorToken: "&&",
            left: {
              kind: "prefixUnaryExpression",
              operatorToken: "!",
              operand: parenthesize(
                buildOrChain([stringCheck, numericCheck, booleanCheck])
              ),
            },
            right: {
              kind: "prefixUnaryExpression",
              operatorToken: "!",
              operand: parenthesize(functionCheck),
            },
          }),
        });
      default:
        return undefined;
    }
  })();

  if (!positive) {
    return undefined;
  }

  return negate
    ? {
        kind: "prefixUnaryExpression",
        operatorToken: "!",
        operand: parenthesize(positive),
      }
    : positive;
};

const extractTypeofComparison = (
  expr: Extract<IrExpression, { kind: "binary" }>
):
  | {
      readonly target: IrExpression;
      readonly tag: string;
      readonly negate: boolean;
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
  ):
    | {
        readonly target: IrExpression;
        readonly tag: string;
      }
    | undefined => {
    if (left.kind !== "unary" || left.operator !== "typeof") {
      return undefined;
    }
    if (right.kind !== "literal" || typeof right.value !== "string") {
      return undefined;
    }
    return {
      target: left.expression,
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

export const emitTypeofComparison = (
  expr: Extract<IrExpression, { kind: "binary" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const comparison = extractTypeofComparison(expr);
  if (!comparison) {
    return undefined;
  }

  const target = unwrapTransparentNarrowingTarget(comparison.target);
  if (!target) {
    return undefined;
  }

  const bindingKey =
    target.kind === "identifier"
      ? target.name
      : getMemberAccessNarrowKey(target);
  const localSemanticType =
    target.kind === "identifier"
      ? context.localSemanticTypes?.get(target.name)
      : undefined;
  const currentType =
    (bindingKey
      ? currentNarrowedType(
          bindingKey,
          localSemanticType ??
            target.inferredType ??
            comparison.target.inferredType,
          context
        )
      : undefined) ??
    localSemanticType ??
    target.inferredType ??
    comparison.target.inferredType;
  const resolvedCurrent = currentType
    ? resolveTypeAlias(stripNullish(currentType), context)
    : undefined;

  if (!resolvedCurrent) {
    return undefined;
  }

  const [targetAst, targetContext] = emitExpressionAst(target, context);
  const canUseBroadTypeof =
    resolvedCurrent.kind === "unknownType" ||
    resolvedCurrent.kind === "anyType" ||
    isBroadObjectSlotType(resolvedCurrent, context);
  if (canUseBroadTypeof) {
    const check = buildBroadTypeofCheck(
      parenthesize(targetAst),
      comparison.tag,
      comparison.negate
    );
    return check ? [check, targetContext] : undefined;
  }

  const directStorageType =
    target.kind === "identifier"
      ? resolveIdentifierRuntimeCarrierType(target, targetContext)
      : resolveDirectStorageExpressionType(target, targetAst, targetContext);
  const identifierStorageType =
    target.kind === "identifier"
      ? targetContext.localValueTypes?.get(target.name)
      : undefined;
  const identifierSemanticType =
    target.kind === "identifier"
      ? targetContext.localSemanticTypes?.get(target.name)
      : undefined;
  const storageTypeofCandidate = identifierStorageType ?? directStorageType;
  const resolvedStorageTypeofCandidate = storageTypeofCandidate
    ? resolveTypeAlias(stripNullish(storageTypeofCandidate), targetContext)
    : undefined;
  const shouldUseBroadStorageTypeof =
    storageTypeofCandidate !== undefined &&
    getRuntimeUnionCarrierMembers(storageTypeofCandidate, targetContext) ===
      undefined &&
    resolvedStorageTypeofCandidate !== undefined &&
    (resolvedStorageTypeofCandidate.kind === "unknownType" ||
      resolvedStorageTypeofCandidate.kind === "anyType" ||
      isBroadObjectSlotType(resolvedStorageTypeofCandidate, targetContext));
  if (shouldUseBroadStorageTypeof) {
    const check = buildBroadTypeofCheck(
      parenthesize(targetAst),
      comparison.tag,
      comparison.negate
    );
    return check ? [check, targetContext] : undefined;
  }

  const runtimeCarrierType =
    selectRuntimeUnionCarrierType(
      targetContext,
      identifierStorageType,
      identifierSemanticType,
      directStorageType,
      resolveRuntimeCarrierIrType(target, targetContext),
      currentType
    ) ??
    directStorageType ??
    resolveRuntimeCarrierIrType(target, targetContext);

  const alignedCarrierMembers =
    bindingKey && currentType
      ? resolveAlignedRuntimeUnionMembers(
          bindingKey,
          currentType,
          runtimeCarrierType,
          targetContext
        )
      : undefined;

  if (alignedCarrierMembers) {
    const matchingMemberNs = alignedCarrierMembers.members.flatMap(
      (member, index) =>
        member && matchesTypeofTag(member, comparison.tag, targetContext)
          ? [alignedCarrierMembers.candidateMemberNs[index] ?? index + 1]
          : []
    );
    const runtimeCarrierAst =
      (runtimeCarrierType
        ? resolveRuntimeCarrierExpressionAst(target, targetContext)
        : undefined) ?? targetAst;
    return buildRuntimeUnionMemberCheck({
      receiver: runtimeCarrierAst,
      memberNs: matchingMemberNs,
      negate: comparison.negate,
      context: targetContext,
    });
  }

  if (resolvedCurrent.kind !== "unionType") {
    const matches = matchesTypeofTag(resolvedCurrent, comparison.tag, context);
    return [booleanLiteral(comparison.negate ? !matches : matches), context];
  }

  return undefined;
};

/**
 * Emit an `instanceof` expression as a C# `is` pattern expression.
 */
export const emitInstanceof = (
  expr: Extract<IrExpression, { kind: "binary" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const normalizedTargetType = normalizeInstanceofTargetType(
    expr.right.inferredType
  );
  const leftOperandType = expr.left.inferredType;
  const target = unwrapTransparentNarrowingTarget(expr.left);
  const bindingKey =
    target?.kind === "identifier"
      ? target.name
      : target
        ? getMemberAccessNarrowKey(target)
        : undefined;
  const effectiveLeftType =
    (bindingKey && leftOperandType
      ? currentNarrowedType(
          bindingKey,
          target?.inferredType ?? leftOperandType,
          context
        )
      : undefined) ?? leftOperandType;

  const [leftAst, leftContext] = emitExpressionAst(
    target ?? expr.left,
    context
  );
  const directStorageType =
    target?.kind === "identifier"
      ? resolveIdentifierRuntimeCarrierType(target, leftContext)
      : resolveDirectStorageExpressionType(
          target ?? expr.left,
          leftAst,
          leftContext
        );
  const identifierStorageType =
    target?.kind === "identifier"
      ? leftContext.localValueTypes?.get(target.name)
      : undefined;
  const identifierSemanticType =
    target?.kind === "identifier"
      ? leftContext.localSemanticTypes?.get(target.name)
      : undefined;
  const runtimeCarrierType =
    selectRuntimeUnionCarrierType(
      leftContext,
      identifierStorageType,
      identifierSemanticType,
      directStorageType,
      resolveRuntimeCarrierIrType(target ?? expr.left, leftContext),
      leftOperandType
    ) ??
    directStorageType ??
    resolveRuntimeCarrierIrType(target ?? expr.left, leftContext);
  const runtimeCarrierAst =
    (runtimeCarrierType
      ? resolveRuntimeCarrierExpressionAst(target ?? expr.left, leftContext)
      : undefined) ?? leftAst;
  const alignedCarrierMembers =
    normalizedTargetType && effectiveLeftType
      ? resolveAlignedRuntimeUnionMembers(
          bindingKey,
          effectiveLeftType,
          runtimeCarrierType,
          leftContext
        )
      : undefined;
  if (normalizedTargetType && alignedCarrierMembers) {
    const { members: effectiveMembers, candidateMemberNs } =
      alignedCarrierMembers;

    const matchingMemberNs = effectiveMembers.flatMap((member, index) => {
      if (!member) {
        return [];
      }

      const exactMatches = findExactRuntimeUnionMemberIndices(
        [member],
        normalizedTargetType,
        leftContext
      );
      if (exactMatches.length > 0) {
        return [candidateMemberNs[index] ?? index + 1];
      }

      const semanticMatches = findRuntimeUnionMemberIndices(
        [member],
        normalizedTargetType,
        leftContext
      );
      const instanceofMatches = findRuntimeUnionInstanceofMemberIndices(
        [member],
        normalizedTargetType,
        leftContext
      );
      return semanticMatches.length > 0
        ? [candidateMemberNs[index] ?? index + 1]
        : instanceofMatches.length > 0
          ? [candidateMemberNs[index] ?? index + 1]
          : [];
    });

    if (matchingMemberNs.length > 0) {
      return buildRuntimeUnionMemberCheck({
        receiver: runtimeCarrierAst,
        memberNs: matchingMemberNs,
        negate: false,
        context: leftContext,
      });
    }
  }

  if (normalizedTargetType && runtimeCarrierType) {
    const hasActiveNarrowing =
      bindingKey !== undefined && leftContext.narrowedBindings?.has(bindingKey);
    if (!hasActiveNarrowing) {
      const runtimeMembers = getRuntimeUnionCarrierMembers(
        runtimeCarrierType,
        leftContext
      );
      const matchingMemberNs =
        runtimeMembers?.flatMap((member, index) =>
          runtimeUnionMemberMatchesInstanceofTarget(
            member,
            normalizedTargetType,
            leftContext
          )
            ? [index + 1]
            : []
        ) ?? [];
      if (matchingMemberNs.length > 0) {
        return buildRuntimeUnionMemberCheck({
          receiver: runtimeCarrierAst,
          memberNs: matchingMemberNs,
          negate: false,
          context: leftContext,
        });
      }
    }

    const projection = tryExtractRuntimeUnionMemberProjection(leftAst);
    const runtimeMembers = getRuntimeUnionCarrierMembers(
      runtimeCarrierType,
      leftContext
    );
    const projectedMember = projection
      ? runtimeMembers?.[projection.memberN - 1]
      : undefined;
    if (
      projection &&
      runtimeUnionMemberMatchesInstanceofTarget(
        projectedMember,
        normalizedTargetType,
        leftContext
      )
    ) {
      return buildRuntimeUnionMemberCheck({
        receiver: projection.receiver,
        memberNs: [projection.memberN],
        negate: false,
        context: leftContext,
      });
    }
  }

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
