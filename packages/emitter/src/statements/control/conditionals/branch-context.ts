/**
 * Branch context manipulation helpers for if-statement emission.
 * Builds narrowed bindings, union complement bindings, cast declarations,
 * and condition AST nodes.
 */

import {
  IrExpression,
  IrStatement,
  IrType,
  normalizedUnionType,
  stableIrTypeKey,
} from "@tsonic/frontend";
import { EmitterContext, NarrowedBinding } from "../../../types.js";
import { emitExpressionAst } from "../../../expression-emitter.js";
import { emitTypeAst } from "../../../type-emitter.js";
import type {
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpBlockStatementAst,
  CSharpTypeAst,
} from "../../../core/format/backend-ast/types.js";
import { emitStatementAst } from "../../../statement-emitter.js";
import { materializeDirectNarrowingAst } from "../../../core/semantic/materialized-narrowing.js";
import { normalizeRuntimeStorageType } from "../../../core/semantic/storage-types.js";

export type EmitExprAstFn = (
  e: IrExpression,
  ctx: EmitterContext
) => [CSharpExpressionAst, EmitterContext];

/** Standard emitExpressionAst adapter for emitBooleanConditionAst callback. */
export const emitExprAstCb: EmitExprAstFn = (e, ctx) =>
  emitExpressionAst(e, ctx);

export const mergeBranchContextMeta = (
  preferred: EmitterContext,
  alternate: EmitterContext
): EmitterContext => ({
  ...preferred,
  tempVarId: Math.max(preferred.tempVarId ?? 0, alternate.tempVarId ?? 0),
  usings: new Set([...(preferred.usings ?? []), ...(alternate.usings ?? [])]),
  usedLocalNames: new Set([
    ...(preferred.usedLocalNames ?? []),
    ...(alternate.usedLocalNames ?? []),
  ]),
});

const joinTypes = (
  left: IrType | undefined,
  right: IrType | undefined
): IrType | undefined => {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  return stableIrTypeKey(left) === stableIrTypeKey(right)
    ? left
    : normalizedUnionType([left, right]);
};

const getBindingEffectiveType = (
  binding: NarrowedBinding | undefined
): IrType | undefined => binding?.type ?? binding?.sourceType;

const getBindingSourceType = (
  binding: NarrowedBinding | undefined
): IrType | undefined => binding?.sourceType ?? binding?.type;

const getBindingCarrierAst = (
  binding: NarrowedBinding | undefined
): CSharpExpressionAst | undefined => {
  if (!binding) {
    return undefined;
  }

  switch (binding.kind) {
    case "expr":
      return binding.carrierExprAst ?? binding.storageExprAst ?? binding.exprAst;
    case "runtimeSubset":
      return binding.storageExprAst;
    case "rename":
      return undefined;
  }
};

const getBindingStorageType = (
  binding: NarrowedBinding | undefined
): IrType | undefined => {
  if (!binding) {
    return undefined;
  }

  switch (binding.kind) {
    case "expr":
      return binding.storageType ?? binding.sourceType ?? binding.type;
    case "runtimeSubset":
      return binding.sourceType ?? binding.type;
    case "rename":
      return undefined;
  }
};

const sameCarrierAst = (
  left: CSharpExpressionAst | undefined,
  right: CSharpExpressionAst | undefined
): boolean =>
  !left || !right || JSON.stringify(left) === JSON.stringify(right);

const mergeJoinedBinding = (
  baseBinding: NarrowedBinding | undefined,
  preferredBinding: NarrowedBinding | undefined,
  alternateBinding: NarrowedBinding | undefined,
  context: EmitterContext
): [NarrowedBinding | undefined, EmitterContext] => {
  const preferredType =
    getBindingEffectiveType(preferredBinding) ?? getBindingEffectiveType(baseBinding);
  const alternateType =
    getBindingEffectiveType(alternateBinding) ?? getBindingEffectiveType(baseBinding);
  if (!preferredType || !alternateType) {
    return [baseBinding, context];
  }

  const mergedType = joinTypes(preferredType, alternateType);
  const mergedSourceType = joinTypes(
    getBindingSourceType(preferredBinding) ?? getBindingSourceType(baseBinding),
    getBindingSourceType(alternateBinding) ?? getBindingSourceType(baseBinding)
  );
  if (!mergedType || !mergedSourceType) {
    return [baseBinding, context];
  }

  if (stableIrTypeKey(mergedType) === stableIrTypeKey(mergedSourceType)) {
    return [undefined, context];
  }

  const preferredCarrierAst =
    getBindingCarrierAst(preferredBinding) ?? getBindingCarrierAst(baseBinding);
  const alternateCarrierAst =
    getBindingCarrierAst(alternateBinding) ?? getBindingCarrierAst(baseBinding);
  if (!sameCarrierAst(preferredCarrierAst, alternateCarrierAst)) {
    return [baseBinding, context];
  }

  const carrierAst = preferredCarrierAst ?? alternateCarrierAst;
  if (!carrierAst) {
    return [baseBinding, context];
  }

  const mergedStorageType =
    joinTypes(
      getBindingStorageType(preferredBinding) ?? getBindingStorageType(baseBinding),
      getBindingStorageType(alternateBinding) ??
        getBindingStorageType(baseBinding)
    ) ?? mergedSourceType;
  const [mergedExprAst, nextContext] = materializeDirectNarrowingAst(
    carrierAst,
    mergedStorageType,
    mergedType,
    context
  );

  return [
    buildExprBinding(
      mergedExprAst,
      mergedType,
      mergedSourceType,
      carrierAst,
      mergedStorageType,
      carrierAst
    ),
    nextContext,
  ];
};

export const mergeBranchFlowState = (
  base: EmitterContext,
  preferred: EmitterContext,
  alternate: EmitterContext,
  context: EmitterContext
): [ReadonlyMap<string, NarrowedBinding> | undefined, EmitterContext] => {
  const baseBindings = base.narrowedBindings;
  const preferredBindings = preferred.narrowedBindings;
  const alternateBindings = alternate.narrowedBindings;
  const keys = new Set<string>([
    ...(baseBindings?.keys() ?? []),
    ...(preferredBindings?.keys() ?? []),
    ...(alternateBindings?.keys() ?? []),
  ]);

  const merged = new Map(baseBindings ?? []);
  let currentContext = context;
  for (const key of keys) {
    const [nextBinding, nextContext] = mergeJoinedBinding(
      baseBindings?.get(key),
      preferredBindings?.get(key),
      alternateBindings?.get(key),
      currentContext
    );
    currentContext = nextContext;
    if (nextBinding) {
      merged.set(key, nextBinding);
      continue;
    }

    merged.delete(key);
  }

  return [merged.size > 0 ? merged : undefined, currentContext];
};

export const mergeBranchExitContext = (
  base: EmitterContext,
  preferred: EmitterContext,
  alternate: EmitterContext
): EmitterContext => {
  const mergedMeta = mergeBranchContextMeta(preferred, alternate);
  const [narrowedBindings, mergedContext] = mergeBranchFlowState(
    base,
    preferred,
    alternate,
    mergedMeta
  );

  return {
    ...mergedContext,
    narrowedBindings,
  };
};

export const resetBranchFlowState = (
  base: EmitterContext,
  branchContext: EmitterContext
): EmitterContext =>
  mergeBranchContextMeta(
    {
      ...base,
      narrowedBindings: base.narrowedBindings,
    },
    branchContext
  );

export const toReceiverAst = (
  receiver: string | CSharpExpressionAst
): CSharpExpressionAst =>
  typeof receiver === "string"
    ? { kind: "identifierExpression", identifier: receiver }
    : receiver;

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

/**
 * Build AST for a union narrowing expression: (escapedOrig.AsN())
 */
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

export const buildComplementNarrowedBinding = (
  receiver: string | CSharpExpressionAst,
  runtimeUnionArity: number,
  candidateMemberNs: readonly number[],
  candidateMembers: readonly IrType[],
  selectedMemberN: number,
  sourceType?: IrType,
  sourceMembers?: readonly IrType[],
  sourceCandidateMemberNs?: readonly number[]
): NarrowedBinding | undefined => {
  const remainingPairs = candidateMemberNs.flatMap((runtimeMemberN, index) => {
    if (runtimeMemberN === selectedMemberN) {
      return [];
    }

    const memberType = candidateMembers[index];
    if (!memberType) {
      return [];
    }

    return [{ runtimeMemberN, memberType }];
  });

  if (remainingPairs.length === 0) {
    return undefined;
  }

  if (remainingPairs.length === 1) {
    const remaining = remainingPairs[0];
    if (!remaining) return undefined;
    const narrowedAst = buildUnionNarrowAst(receiver, remaining.runtimeMemberN);

    return buildProjectedExprBinding(
      narrowedAst,
      remaining.memberType,
      sourceType,
      toReceiverAst(receiver)
    );
  }

  return {
    kind: "runtimeSubset",
    runtimeMemberNs: remainingPairs.map((pair) => pair.runtimeMemberN),
    runtimeUnionArity,
    storageExprAst: toReceiverAst(receiver),
    sourceMembers: [...(sourceMembers ?? candidateMembers)],
    sourceCandidateMemberNs: [
      ...(sourceCandidateMemberNs ?? candidateMemberNs),
    ],
    type: buildSubsetUnionType(remainingPairs.map((pair) => pair.memberType)),
    sourceType,
  };
};

export const buildComplementNarrowedBindingForMembers = (
  receiver: string | CSharpExpressionAst,
  runtimeUnionArity: number,
  candidateMemberNs: readonly number[],
  candidateMembers: readonly IrType[],
  selectedMemberNs: readonly number[],
  sourceType?: IrType,
  sourceMembers?: readonly IrType[],
  sourceCandidateMemberNs?: readonly number[]
): NarrowedBinding | undefined => {
  const selectedSet = new Set(selectedMemberNs);
  const remainingPairs = candidateMemberNs.flatMap((runtimeMemberN, index) => {
    if (selectedSet.has(runtimeMemberN)) {
      return [];
    }

    const memberType = candidateMembers[index];
    if (!memberType) {
      return [];
    }

    return [{ runtimeMemberN, memberType }];
  });

  if (remainingPairs.length === 0) {
    return undefined;
  }

  if (remainingPairs.length === 1) {
    const remaining = remainingPairs[0];
    if (!remaining) return undefined;
    const narrowedAst = buildUnionNarrowAst(receiver, remaining.runtimeMemberN);

    return buildProjectedExprBinding(
      narrowedAst,
      remaining.memberType,
      sourceType,
      toReceiverAst(receiver)
    );
  }

  return {
    kind: "runtimeSubset",
    runtimeMemberNs: remainingPairs.map((pair) => pair.runtimeMemberN),
    runtimeUnionArity,
    storageExprAst: toReceiverAst(receiver),
    sourceMembers: [...(sourceMembers ?? candidateMembers)],
    sourceCandidateMemberNs: [
      ...(sourceCandidateMemberNs ?? candidateMemberNs),
    ],
    type: buildSubsetUnionType(remainingPairs.map((pair) => pair.memberType)),
    sourceType,
  };
};

export const applyExprFallthroughNarrowing = (
  originalName: string,
  exprAst: CSharpExpressionAst,
  narrowedType: IrType,
  baseContext: EmitterContext,
  finalContext: EmitterContext,
  storageType?: IrType
): EmitterContext => {
  const [narrowedTypeAst, narrowedTypeCtx] = emitTypeAst(
    narrowedType,
    finalContext
  );
  const fallthroughBindings = new Map(baseContext.narrowedBindings ?? []);
  fallthroughBindings.set(
    originalName,
    buildExprBinding(
      {
        kind: "castExpression",
        type: narrowedTypeAst,
        expression: exprAst,
      },
      narrowedType,
      undefined,
      exprAst,
      storageType,
      exprAst
    )
  );

  return {
    ...narrowedTypeCtx,
    narrowedBindings: fallthroughBindings,
  };
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

export const withComplementNarrowing = (
  originalName: string,
  receiver: string | CSharpExpressionAst,
  runtimeUnionArity: number,
  candidateMemberNs: readonly number[],
  candidateMembers: readonly IrType[],
  selectedMemberN: number,
  baseContext: EmitterContext
): EmitterContext => {
  const existingBinding = baseContext.narrowedBindings?.get(originalName);
  const sourceType =
    existingBinding?.sourceType ?? buildSubsetUnionType(candidateMembers);
  const sourceMembers =
    existingBinding?.kind === "runtimeSubset" &&
    existingBinding.sourceMembers &&
    existingBinding.sourceCandidateMemberNs &&
    existingBinding.sourceMembers.length ===
      existingBinding.sourceCandidateMemberNs.length
      ? existingBinding.sourceMembers
      : undefined;
  const sourceCandidateMemberNs =
    existingBinding?.kind === "runtimeSubset" &&
    existingBinding.sourceMembers &&
    existingBinding.sourceCandidateMemberNs &&
    existingBinding.sourceMembers.length ===
      existingBinding.sourceCandidateMemberNs.length
      ? existingBinding.sourceCandidateMemberNs
      : undefined;
  const binding = buildComplementNarrowedBinding(
    receiver,
    runtimeUnionArity,
    candidateMemberNs,
    candidateMembers,
    selectedMemberN,
    sourceType,
    sourceMembers,
    sourceCandidateMemberNs
  );

  if (!binding) {
    return baseContext;
  }

  const narrowedBindings = new Map(baseContext.narrowedBindings ?? []);
  narrowedBindings.set(originalName, binding);
  return { ...baseContext, narrowedBindings };
};

export const withComplementNarrowingForMembers = (
  originalName: string,
  receiver: string | CSharpExpressionAst,
  runtimeUnionArity: number,
  candidateMemberNs: readonly number[],
  candidateMembers: readonly IrType[],
  selectedMemberNs: readonly number[],
  baseContext: EmitterContext
): EmitterContext => {
  const existingBinding = baseContext.narrowedBindings?.get(originalName);
  const sourceType =
    existingBinding?.sourceType ?? buildSubsetUnionType(candidateMembers);
  const sourceMembers =
    existingBinding?.kind === "runtimeSubset" &&
    existingBinding.sourceMembers &&
    existingBinding.sourceCandidateMemberNs &&
    existingBinding.sourceMembers.length ===
      existingBinding.sourceCandidateMemberNs.length
      ? existingBinding.sourceMembers
      : undefined;
  const sourceCandidateMemberNs =
    existingBinding?.kind === "runtimeSubset" &&
    existingBinding.sourceMembers &&
    existingBinding.sourceCandidateMemberNs &&
    existingBinding.sourceMembers.length ===
      existingBinding.sourceCandidateMemberNs.length
      ? existingBinding.sourceCandidateMemberNs
      : undefined;
  const binding = buildComplementNarrowedBindingForMembers(
    receiver,
    runtimeUnionArity,
    candidateMemberNs,
    candidateMembers,
    selectedMemberNs,
    sourceType,
    sourceMembers,
    sourceCandidateMemberNs
  );

  if (!binding) {
    return baseContext;
  }

  const narrowedBindings = new Map(baseContext.narrowedBindings ?? []);
  narrowedBindings.set(originalName, binding);
  return { ...baseContext, narrowedBindings };
};

export const withRuntimeUnionMemberNarrowing = (
  originalName: string,
  receiver: string | CSharpExpressionAst,
  memberN: number,
  memberType: IrType,
  sourceType: IrType | undefined,
  baseContext: EmitterContext,
  storageType?: IrType
): EmitterContext => {
  const narrowedBindings = new Map(baseContext.narrowedBindings ?? []);
  const narrowedAst = buildUnionNarrowAst(receiver, memberN);
  narrowedBindings.set(
    originalName,
    buildExprBinding(
      narrowedAst,
      memberType,
      sourceType,
      narrowedAst,
      storageType ??
        normalizeRuntimeStorageType(memberType, baseContext) ??
        memberType,
      toReceiverAst(receiver)
    )
  );
  return { ...baseContext, narrowedBindings };
};

/** Wrap an array of statements in a single statement (block if >1). */
export const wrapInBlock = (
  stmts: readonly CSharpStatementAst[]
): CSharpStatementAst => {
  if (stmts.length === 1 && stmts[0]) return stmts[0];
  return { kind: "blockStatement", statements: [...stmts] };
};

const getNarrowBindingRoot = (bindingKey: string): string => {
  if (bindingKey.startsWith("this.")) {
    return "this";
  }

  const dotIndex = bindingKey.indexOf(".");
  return dotIndex >= 0 ? bindingKey.slice(0, dotIndex) : bindingKey;
};

const collectScopedShadowRoots = (
  outerLocalNames: ReadonlyMap<string, string> | undefined,
  innerLocalNames: ReadonlyMap<string, string> | undefined
): ReadonlySet<string> => {
  if (!innerLocalNames || innerLocalNames.size === 0) {
    return new Set<string>();
  }

  const shadowed = new Set<string>();
  for (const [originalName, emittedName] of innerLocalNames) {
    if (outerLocalNames?.get(originalName) !== emittedName) {
      shadowed.add(originalName);
    }
  }

  return shadowed;
};

const filterEscapedBranchNarrowings = (
  outerContext: EmitterContext,
  innerContext: EmitterContext
): ReadonlyMap<string, NarrowedBinding> | undefined => {
  const innerBindings = innerContext.narrowedBindings;
  if (!innerBindings || innerBindings.size === 0) {
    return undefined;
  }

  const shadowedRoots = collectScopedShadowRoots(
    outerContext.localNameMap,
    innerContext.localNameMap
  );
  if (shadowedRoots.size === 0) {
    return innerBindings;
  }

  const escaped = new Map<string, NarrowedBinding>();
  for (const [bindingKey, binding] of innerBindings) {
    const root = getNarrowBindingRoot(bindingKey);
    if (root !== "this" && shadowedRoots.has(root)) {
      continue;
    }
    escaped.set(bindingKey, binding);
  }

  return escaped.size > 0 ? escaped : undefined;
};

const restoreEscapedBranchScope = (
  outerContext: EmitterContext,
  innerContext: EmitterContext
): EmitterContext => ({
  ...innerContext,
  localNameMap: outerContext.localNameMap,
  conditionAliases: outerContext.conditionAliases,
  localSemanticTypes: outerContext.localSemanticTypes,
  localValueTypes: outerContext.localValueTypes,
  narrowedBindings: filterEscapedBranchNarrowings(outerContext, innerContext),
});

export const emitBranchScopedStatementAst = (
  bodyStmt: IrStatement,
  bodyCtx: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  const scopedContext: EmitterContext = {
    ...bodyCtx,
    localNameMap: new Map(bodyCtx.localNameMap ?? []),
    conditionAliases: new Map(bodyCtx.conditionAliases ?? []),
    localSemanticTypes: new Map(bodyCtx.localSemanticTypes ?? []),
    localValueTypes: new Map(bodyCtx.localValueTypes ?? []),
  };

  let emittedStatements: readonly CSharpStatementAst[];
  let innerContext: EmitterContext;

  if (bodyStmt.kind === "blockStatement") {
    const flattenedStatements: CSharpStatementAst[] = [];
    let currentContext = scopedContext;
    for (const statement of bodyStmt.statements) {
      const [nextStatements, nextContext] = emitStatementAst(
        statement,
        currentContext
      );
      flattenedStatements.push(...nextStatements);
      currentContext = nextContext;
    }
    emittedStatements = flattenedStatements;
    innerContext = currentContext;
  } else {
    [emittedStatements, innerContext] = emitStatementAst(bodyStmt, scopedContext);
  }

  return [
    emittedStatements,
    restoreEscapedBranchScope(bodyCtx, innerContext),
  ];
};

/**
 * Emit a forced block with a preamble line as AST.
 * Builds a blockStatement with preamble statements + body statements.
 *
 * If bodyStmt is already a block, its statements are inlined to avoid nesting.
 */
export const emitForcedBlockWithPreambleAst = (
  preambleStmts: readonly CSharpStatementAst[],
  bodyStmt: IrStatement,
  bodyCtx: EmitterContext
): [CSharpBlockStatementAst, EmitterContext] => {
  const [bodyStatements, finalContext] = emitBranchScopedStatementAst(
    bodyStmt,
    bodyCtx
  );
  return [
    {
      kind: "blockStatement",
      statements: [...preambleStmts, ...bodyStatements],
    },
    finalContext,
  ];
};

/**
 * Build a `var name = expr.AsN();` statement as AST.
 */
export const buildCastLocalDecl = (
  varName: string,
  receiver: string | CSharpExpressionAst,
  memberN: number,
  narrowedTypeAst?: CSharpTypeAst
): CSharpStatementAst => ({
  kind: "localDeclarationStatement",
  modifiers: [],
  type: narrowedTypeAst ?? { kind: "varType" },
  declarators: [
    {
      name: varName,
      initializer:
        narrowedTypeAst === undefined
          ? {
              kind: "invocationExpression",
              expression: {
                kind: "memberAccessExpression",
                expression: toReceiverAst(receiver),
                memberName: `As${memberN}`,
              },
              arguments: [],
            }
          : {
              kind: "castExpression",
              type: narrowedTypeAst,
              expression: {
                kind: "invocationExpression",
                expression: {
                  kind: "memberAccessExpression",
                  expression: toReceiverAst(receiver),
                  memberName: `As${memberN}`,
                },
                arguments: [],
              },
            },
    },
  ],
});

/**
 * Build the condition expression `orig.IsN()` or `!orig.IsN()`.
 */
export const buildIsNCondition = (
  receiver: string | CSharpExpressionAst,
  memberN: number,
  negate: boolean
): CSharpExpressionAst => {
  const isCall: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: toReceiverAst(receiver),
      memberName: `Is${memberN}`,
    },
    arguments: [],
  };
  return negate
    ? { kind: "prefixUnaryExpression", operatorToken: "!", operand: isCall }
    : isCall;
};

export const buildAnyIsNCondition = (
  receiver: string | CSharpExpressionAst,
  memberNs: readonly number[],
  negate: boolean
): CSharpExpressionAst => {
  const conditions = memberNs.map((memberN) =>
    buildIsNCondition(receiver, memberN, false)
  );
  const combined = conditions.reduce<CSharpExpressionAst | undefined>(
    (current, condition) =>
      current
        ? {
            kind: "parenthesizedExpression",
            expression: {
              kind: "binaryExpression",
              operatorToken: "||",
              left: current,
              right: condition,
            },
          }
        : condition,
    undefined
  );
  const base = combined ?? buildIsNCondition(receiver, 1, false);
  return negate
    ? { kind: "prefixUnaryExpression", operatorToken: "!", operand: base }
    : base;
};

/**
 * Build the condition expression `orig is TypeName varName`.
 */
export const buildIsPatternCondition = (
  receiver: string | CSharpExpressionAst,
  rhsTypeAst: CSharpTypeAst,
  escapedNarrow: string
): CSharpExpressionAst => ({
  kind: "isExpression",
  expression: toReceiverAst(receiver),
  pattern: {
    kind: "declarationPattern",
    type: rhsTypeAst,
    designation: escapedNarrow,
  },
});
