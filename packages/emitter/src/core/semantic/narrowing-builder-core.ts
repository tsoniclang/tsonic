/**
 * Core narrowing builder types and utilities.
 *
 * Provides foundational types (BranchTruthiness, EmitExprAstFn, RuntimeUnionFrame),
 * simple AST builders for union narrowing, binding management helpers,
 * nullish guard construction/stripping, and type-narrowing predicates.
 */

import { IrExpression, IrType, normalizedUnionType } from "@tsonic/frontend";
import type { EmitterContext, NarrowedBinding } from "../../types.js";
import type { CSharpExpressionAst } from "../format/backend-ast/types.js";
import { identifierExpression } from "../format/backend-ast/builders.js";
import { emitTypeAst } from "../../type-emitter.js";
import { nullLiteral } from "../format/backend-ast/builders.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import {
  stripNullish,
  resolveTypeAlias,
  unionMemberMatchesTarget,
} from "./type-resolution.js";
import {
  resolveNarrowedUnionMembers,
  type NarrowedUnionMembers,
} from "./narrowed-union-resolution.js";
import {
  RuntimeMaterializationSourceFrame,
  tryBuildRuntimeMaterializationAst,
} from "./runtime-reification.js";

export type BranchTruthiness = "truthy" | "falsy";

export type EmitExprAstFn = (
  expr: IrExpression,
  context: EmitterContext
) => [CSharpExpressionAst, EmitterContext];

export type RuntimeUnionFrame = NarrowedUnionMembers;

export type RuntimeSubsetSourceInfo = {
  readonly sourceType: IrType;
  readonly sourceMembers?: readonly IrType[];
  readonly sourceCandidateMemberNs?: readonly number[];
  readonly runtimeUnionArity?: number;
};

export const toReceiverAst = (
  receiver: string | CSharpExpressionAst
): CSharpExpressionAst =>
  typeof receiver === "string"
    ? { kind: "identifierExpression", identifier: receiver }
    : receiver;

export const buildUnionNarrowAst = (
  receiver: string | CSharpExpressionAst,
  memberN: number
): CSharpExpressionAst => ({
  kind: "parenthesizedExpression",
  expression: {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: toReceiverAst(receiver),
      memberName: `As${memberN}`,
    },
    arguments: [],
  },
});

const unwrapProjectionAst = (ast: CSharpExpressionAst): CSharpExpressionAst => {
  let current = ast;
  while (
    current.kind === "parenthesizedExpression" ||
    current.kind === "castExpression"
  ) {
    current = current.expression;
  }
  return current;
};

const tryReadRuntimeUnionFactoryMemberN = (
  ast: CSharpExpressionAst
): number | undefined => {
  const current = unwrapProjectionAst(ast);
  if (
    current.kind !== "invocationExpression" ||
    current.expression.kind !== "memberAccessExpression"
  ) {
    return undefined;
  }

  const match = /^From([1-9][0-9]*)$/.exec(current.expression.memberName);
  return match?.[1] ? Number.parseInt(match[1], 10) : undefined;
};

const unwrapParenthesizedAst = (
  ast: CSharpExpressionAst
): CSharpExpressionAst => {
  let current = ast;
  while (current.kind === "parenthesizedExpression") {
    current = current.expression;
  }
  return current;
};

const stableCarrierExpressionKey = (
  ast: CSharpExpressionAst
): string | undefined => {
  const current = unwrapParenthesizedAst(ast);
  switch (current.kind) {
    case "identifierExpression":
      return `id:${current.identifier}`;
    case "memberAccessExpression": {
      const receiverKey = stableCarrierExpressionKey(current.expression);
      return receiverKey
        ? `member:${receiverKey}.${current.memberName}`
        : undefined;
    }
    case "elementAccessExpression": {
      const receiverKey = stableCarrierExpressionKey(current.expression);
      const argumentKeys = current.arguments.map(stableCarrierExpressionKey);
      return receiverKey &&
        argumentKeys.every((key): key is string => key !== undefined)
        ? `element:${receiverKey}[${argumentKeys.join(",")}]`
        : undefined;
    }
    case "castExpression":
    case "asExpression":
      return stableCarrierExpressionKey(current.expression);
    case "suppressNullableWarningExpression":
      return stableCarrierExpressionKey(current.expression);
    default:
      return undefined;
  }
};

export const tryMapProjectedRuntimeMemberN = (
  receiver: string | CSharpExpressionAst,
  sourceMemberN: number
): number | undefined => {
  if (typeof receiver === "string") {
    return undefined;
  }

  const current = unwrapProjectionAst(receiver);
  if (
    current.kind !== "invocationExpression" ||
    current.expression.kind !== "memberAccessExpression" ||
    current.expression.memberName !== "Match"
  ) {
    return undefined;
  }

  const lambda = current.arguments[sourceMemberN - 1];
  if (!lambda || lambda.kind !== "lambdaExpression") {
    return undefined;
  }

  return lambda.body.kind === "blockStatement"
    ? undefined
    : tryReadRuntimeUnionFactoryMemberN(lambda.body);
};

export const buildMappedUnionNarrowAst = (
  receiver: string | CSharpExpressionAst,
  sourceMemberN: number
): CSharpExpressionAst =>
  buildUnionNarrowAst(
    receiver,
    tryMapProjectedRuntimeMemberN(receiver, sourceMemberN) ?? sourceMemberN
  );

export const buildSubsetUnionType = (
  members: readonly IrType[]
): IrType | undefined => {
  if (members.length === 0) return undefined;
  if (members.length === 1) return members[0];
  return normalizedUnionType(members);
};

export const withoutNarrowedBinding = (
  context: EmitterContext,
  bindingKey: string
): EmitterContext => {
  if (!context.narrowedBindings?.has(bindingKey)) {
    return context;
  }

  const narrowedBindings = new Map(context.narrowedBindings);
  narrowedBindings.delete(bindingKey);

  return {
    ...context,
    narrowedBindings,
  };
};

export const applyBinding = (
  bindingKey: string,
  binding: NarrowedBinding,
  context: EmitterContext
): EmitterContext => {
  const narrowedBindings = new Map(context.narrowedBindings ?? []);
  narrowedBindings.set(bindingKey, binding);
  return {
    ...context,
    narrowedBindings,
  };
};

export const resolveRuntimeSubsetSourceInfo = (
  bindingKey: string,
  currentType: IrType,
  runtimeUnionFrame: RuntimeUnionFrame,
  context: EmitterContext
): RuntimeSubsetSourceInfo => {
  const existingBinding = context.narrowedBindings?.get(bindingKey);
  if (existingBinding?.kind === "runtimeSubset" && existingBinding.sourceType) {
    const hasExplicitSourceFrame =
      existingBinding.sourceMembers &&
      existingBinding.sourceCandidateMemberNs &&
      existingBinding.sourceMembers.length ===
        existingBinding.sourceCandidateMemberNs.length;

    return {
      sourceType: existingBinding.sourceType,
      sourceMembers: hasExplicitSourceFrame
        ? existingBinding.sourceMembers
        : undefined,
      sourceCandidateMemberNs: hasExplicitSourceFrame
        ? existingBinding.sourceCandidateMemberNs
        : undefined,
      runtimeUnionArity: hasExplicitSourceFrame
        ? existingBinding.runtimeUnionArity
        : undefined,
    };
  }

  const canReuseFrameAsSource =
    runtimeUnionFrame.runtimeUnionArity === runtimeUnionFrame.members.length &&
    runtimeUnionFrame.members.length ===
      runtimeUnionFrame.candidateMemberNs.length;

  return {
    sourceType: existingBinding?.sourceType ?? currentType,
    sourceMembers: canReuseFrameAsSource
      ? runtimeUnionFrame.members
      : undefined,
    sourceCandidateMemberNs: canReuseFrameAsSource
      ? runtimeUnionFrame.candidateMemberNs
      : undefined,
    runtimeUnionArity: canReuseFrameAsSource
      ? runtimeUnionFrame.runtimeUnionArity
      : undefined,
  };
};

export const buildExprBinding = (
  exprAst: CSharpExpressionAst,
  type: IrType | undefined,
  sourceType: IrType | undefined,
  storageExprAst?: CSharpExpressionAst,
  storageType?: IrType,
  carrierExprAst?: CSharpExpressionAst,
  carrierType?: IrType
): Extract<NarrowedBinding, { kind: "expr" }> => ({
  kind: "expr",
  exprAst,
  storageExprAst,
  carrierExprAst,
  carrierType,
  storageType,
  type,
  sourceType,
});

export const buildProjectedExprBinding = (
  exprAst: CSharpExpressionAst,
  type: IrType | undefined,
  sourceType: IrType | undefined,
  carrierExprAst: CSharpExpressionAst,
  storageType?: IrType,
  carrierType?: IrType
): Extract<NarrowedBinding, { kind: "expr" }> =>
  buildExprBinding(
    exprAst,
    type,
    sourceType,
    exprAst,
    storageType ?? type,
    carrierExprAst,
    carrierType ?? sourceType
  );

export const resolveExistingNarrowingSourceType = (
  bindingKey: string,
  currentType: IrType | undefined,
  context: EmitterContext
): IrType | undefined =>
  context.narrowedBindings?.get(bindingKey)?.sourceType ?? currentType;

export const buildRuntimeSubsetExpressionAst = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  narrowed: Extract<NarrowedBinding, { kind: "runtimeSubset" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const sourceType = narrowed.sourceType ?? expr.inferredType;
  const subsetType = narrowed.type;
  if (!sourceType || !subsetType) {
    return undefined;
  }

  const sourceFrame: RuntimeMaterializationSourceFrame | undefined =
    narrowed.sourceMembers &&
    narrowed.sourceCandidateMemberNs &&
    narrowed.sourceMembers.length === narrowed.sourceCandidateMemberNs.length
      ? {
          members: narrowed.sourceMembers,
          candidateMemberNs: narrowed.sourceCandidateMemberNs,
          runtimeUnionArity: narrowed.runtimeUnionArity,
        }
      : undefined;

  return tryBuildRuntimeMaterializationAst(
    identifierExpression(escapeCSharpIdentifier(expr.name)),
    sourceType,
    subsetType,
    context,
    emitTypeAst,
    new Set(narrowed.runtimeMemberNs),
    sourceFrame
  );
};

export const buildConditionalNullishGuardAst = (
  sourceAst: CSharpExpressionAst,
  whenNonNull: CSharpExpressionAst,
  targetType: IrType,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [targetTypeAst, nextContext] = emitTypeAst(
    stripNullish(targetType),
    context
  );
  return [
    {
      kind: "conditionalExpression",
      condition: {
        kind: "binaryExpression",
        operatorToken: "==",
        left: {
          kind: "castExpression",
          type: { kind: "predefinedType", keyword: "object" },
          expression: sourceAst,
        },
        right: nullLiteral(),
      },
      whenTrue: {
        kind: "defaultExpression",
        type: targetTypeAst,
      },
      whenFalse: whenNonNull,
    },
    nextContext,
  ];
};

export const tryStripConditionalNullishGuardAst = (
  exprAst: CSharpExpressionAst
): CSharpExpressionAst | undefined => {
  const unwrapObjectCastAst = (
    ast: CSharpExpressionAst
  ): CSharpExpressionAst => {
    const current = unwrapParenthesizedAst(ast);
    if (
      current.kind === "castExpression" &&
      current.type.kind === "predefinedType" &&
      current.type.keyword === "object"
    ) {
      return unwrapParenthesizedAst(current.expression);
    }

    return current;
  };

  let current = exprAst;
  while (current.kind === "parenthesizedExpression") {
    current = current.expression;
  }

  if (current.kind !== "conditionalExpression") {
    return undefined;
  }

  const condition = current.condition;
  if (
    condition.kind !== "binaryExpression" ||
    condition.operatorToken !== "=="
  ) {
    return undefined;
  }

  const checkedExpression = unwrapObjectCastAst(condition.left);

  if (condition.right.kind !== "nullLiteralExpression") {
    return undefined;
  }

  if (current.whenTrue.kind !== "defaultExpression") {
    return undefined;
  }

  const returnedExpression = unwrapParenthesizedAst(current.whenFalse);
  const checkedExpressionKey = stableCarrierExpressionKey(checkedExpression);
  const returnedExpressionKey = stableCarrierExpressionKey(returnedExpression);
  if (
    !checkedExpressionKey ||
    !returnedExpressionKey ||
    checkedExpressionKey !== returnedExpressionKey
  ) {
    const originalCheckedExpression = unwrapParenthesizedAst(condition.left);
    if (
      originalCheckedExpression.kind !== "castExpression" ||
      originalCheckedExpression.type.kind !== "predefinedType" ||
      originalCheckedExpression.type.keyword !== "object"
    ) {
      return undefined;
    }
  }

  return current.whenFalse;
};

export const narrowTypeByNotAssignableTarget = (
  currentType: IrType | undefined,
  targetType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!currentType || !targetType) return undefined;

  const resolvedCurrent = resolveTypeAlias(stripNullish(currentType), context);
  const resolvedTarget = resolveTypeAlias(stripNullish(targetType), context);

  if (resolvedCurrent.kind === "unionType") {
    const kept = resolvedCurrent.types.filter((member): member is IrType => {
      if (!member) return false;
      return !unionMemberMatchesTarget(member, resolvedTarget, context);
    });
    if (kept.length === 0) return undefined;
    if (kept.length === 1) return kept[0];
    return normalizedUnionType(kept);
  }

  return unionMemberMatchesTarget(resolvedCurrent, resolvedTarget, context)
    ? undefined
    : resolvedCurrent;
};

export const currentNarrowedType = (
  bindingKey: string,
  fallbackType: IrType | undefined,
  context: EmitterContext
): IrType | undefined =>
  context.narrowedBindings?.get(bindingKey)?.type ?? fallbackType;

export const resolveRuntimeUnionFrame = resolveNarrowedUnionMembers;

export const isNullOrUndefined = (expr: IrExpression): boolean => {
  if (
    expr.kind === "literal" &&
    (expr.value === null || expr.value === undefined)
  ) {
    return true;
  }

  return expr.kind === "identifier" && expr.name === "undefined";
};
