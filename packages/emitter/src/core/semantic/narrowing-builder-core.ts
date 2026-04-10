/**
 * Core narrowing builder types and utilities.
 *
 * Provides foundational types (BranchTruthiness, EmitExprAstFn, RuntimeUnionFrame),
 * simple AST builders for union narrowing, binding management helpers,
 * nullish guard construction/stripping, and type-narrowing predicates.
 */

import {
  IrExpression,
  IrType,
  normalizedUnionType,
  stableIrTypeKey,
} from "@tsonic/frontend";
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
import { registerLocalSymbolTypes } from "../format/local-names.js";

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
  const narrowedContext: EmitterContext = {
    ...context,
    narrowedBindings,
  };

  if (
    bindingKey === "this" ||
    bindingKey.startsWith("this.") ||
    bindingKey.includes(".")
  ) {
    return narrowedContext;
  }

  const semanticType = binding.type ?? binding.sourceType;
  const storageType = (() => {
    switch (binding.kind) {
      case "rename":
        return binding.sourceType ?? binding.type;
      case "expr":
        return binding.storageType ?? binding.sourceType ?? binding.type;
      case "runtimeSubset":
        return binding.sourceType ?? binding.type;
    }
  })();

  return registerLocalSymbolTypes(
    bindingKey,
    semanticType,
    storageType,
    narrowedContext
  );
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
  };
};

export const buildExprBinding = (
  exprAst: CSharpExpressionAst,
  type: IrType | undefined,
  sourceType: IrType | undefined,
  storageExprAst?: CSharpExpressionAst,
  storageType?: IrType,
  carrierExprAst?: CSharpExpressionAst
): Extract<NarrowedBinding, { kind: "expr" }> => ({
  kind: "expr",
  exprAst,
  storageExprAst,
  carrierExprAst,
  storageType,
  type,
  sourceType,
});

export const buildProjectedExprBinding = (
  exprAst: CSharpExpressionAst,
  type: IrType | undefined,
  sourceType: IrType | undefined,
  carrierExprAst: CSharpExpressionAst,
  storageType?: IrType
): Extract<NarrowedBinding, { kind: "expr" }> =>
  buildExprBinding(
    exprAst,
    type,
    sourceType,
    exprAst,
    storageType ?? type,
    carrierExprAst
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
  if (exprAst.kind !== "conditionalExpression") {
    return undefined;
  }

  const condition = exprAst.condition;
  if (
    condition.kind !== "binaryExpression" ||
    condition.operatorToken !== "=="
  ) {
    return undefined;
  }

  if (
    condition.left.kind !== "castExpression" ||
    condition.left.type.kind !== "predefinedType" ||
    condition.left.type.keyword !== "object"
  ) {
    return undefined;
  }

  if (condition.right.kind !== "nullLiteralExpression") {
    return undefined;
  }

  if (exprAst.whenTrue.kind !== "defaultExpression") {
    return undefined;
  }

  return exprAst.whenFalse;
};

export const isArrayLikeNarrowingCandidate = (
  type: IrType,
  context: EmitterContext
): boolean => {
  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind === "arrayType" || resolved.kind === "tupleType") {
    return true;
  }
  if (
    resolved.kind === "referenceType" &&
    (resolved.name === "Array" ||
      resolved.name === "ReadonlyArray")
  ) {
    return true;
  }
  return false;
};

const hasArrayLikeNarrowingCandidate = (
  type: IrType,
  context: EmitterContext,
  seen = new Set<string>()
): boolean => {
  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (isArrayLikeNarrowingCandidate(resolved, context)) {
    return true;
  }
  if (resolved.kind !== "unionType") {
    return false;
  }

  const key = stableIrTypeKey(resolved);
  if (seen.has(key)) {
    return false;
  }
  const nextSeen = new Set(seen);
  nextSeen.add(key);
  return resolved.types.some((member) =>
    hasArrayLikeNarrowingCandidate(member, context, nextSeen)
  );
};

const isBroadJsValueType = (type: IrType): boolean =>
  type.kind === "referenceType" &&
  (type.name === "JsValue" ||
    type.resolvedClrType === "Tsonic.Runtime.JsValue" ||
    type.resolvedClrType === "global::Tsonic.Runtime.JsValue");

const JS_VALUE_ARRAY_TYPE: IrType = {
  kind: "arrayType",
  elementType: {
    kind: "referenceType",
    name: "JsValue",
    resolvedClrType: "Tsonic.Runtime.JsValue",
  },
};

export const narrowTypeByArrayShape = (
  currentType: IrType | undefined,
  wantArray: boolean,
  context: EmitterContext,
  seen = new Set<string>()
): IrType | undefined => {
  if (!currentType) return undefined;

  const resolved = resolveTypeAlias(stripNullish(currentType), context);
  if (resolved.kind === "unionType") {
    const key = stableIrTypeKey(resolved);
    if (seen.has(key)) {
      return undefined;
    }
    const nextSeen = new Set(seen);
    nextSeen.add(key);
    const kept = resolved.types.flatMap((member): readonly IrType[] => {
      if (!member) return [];
      const isArrayLike = isArrayLikeNarrowingCandidate(member, context);
      if (isArrayLike) {
        return wantArray ? [member] : [];
      }

      const resolvedMember = resolveTypeAlias(stripNullish(member), context);
      if (resolvedMember.kind === "unionType") {
        const nested = narrowTypeByArrayShape(
          member,
          wantArray,
          context,
          nextSeen
        );
        if (!nested) {
          return [];
        }
        if (
          !wantArray &&
          !hasArrayLikeNarrowingCandidate(resolvedMember, context, nextSeen)
        ) {
          return [member];
        }
        return [nested];
      }

      return wantArray ? [] : [member];
    });
    if (kept.length === 0) return undefined;
    if (kept.length === 1) return kept[0];
    return normalizedUnionType(kept);
  }

  const isArrayLike = isArrayLikeNarrowingCandidate(resolved, context);
  if (wantArray) {
    if (
      resolved.kind === "unknownType" ||
      resolved.kind === "anyType" ||
      resolved.kind === "objectType" ||
      (resolved.kind === "referenceType" && resolved.name === "object") ||
      isBroadJsValueType(resolved)
    ) {
      return JS_VALUE_ARRAY_TYPE;
    }
    return isArrayLike ? resolved : undefined;
  }
  return isArrayLike ? undefined : resolved;
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
