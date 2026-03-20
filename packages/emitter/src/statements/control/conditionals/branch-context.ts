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
import { withScoped } from "../../../emitter-types/context.js";

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
});

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
  storageExprAst?: CSharpExpressionAst
): Extract<NarrowedBinding, { kind: "expr" }> => ({
  kind: "expr",
  exprAst,
  storageExprAst,
  type,
  sourceType,
});

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
  members: readonly import("@tsonic/frontend").IrType[]
): import("@tsonic/frontend").IrType | undefined => {
  if (members.length === 0) return undefined;
  if (members.length === 1) return members[0];
  return normalizedUnionType(members);
};

export const buildComplementNarrowedBinding = (
  receiver: string | CSharpExpressionAst,
  runtimeUnionArity: number,
  candidateMemberNs: readonly number[],
  candidateMembers: readonly import("@tsonic/frontend").IrType[],
  selectedMemberN: number,
  sourceType?: import("@tsonic/frontend").IrType,
  sourceMembers?: readonly import("@tsonic/frontend").IrType[],
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

    return buildExprBinding(
      buildUnionNarrowAst(receiver, remaining.runtimeMemberN),
      remaining.memberType,
      sourceType,
      toReceiverAst(receiver)
    );
  }

  return {
    kind: "runtimeSubset",
    runtimeMemberNs: remainingPairs.map((pair) => pair.runtimeMemberN),
    runtimeUnionArity,
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
  candidateMembers: readonly import("@tsonic/frontend").IrType[],
  selectedMemberNs: readonly number[],
  sourceType?: import("@tsonic/frontend").IrType,
  sourceMembers?: readonly import("@tsonic/frontend").IrType[],
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

    return buildExprBinding(
      buildUnionNarrowAst(receiver, remaining.runtimeMemberN),
      remaining.memberType,
      sourceType,
      toReceiverAst(receiver)
    );
  }

  return {
    kind: "runtimeSubset",
    runtimeMemberNs: remainingPairs.map((pair) => pair.runtimeMemberN),
    runtimeUnionArity,
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
  finalContext: EmitterContext
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
  candidateMembers: readonly import("@tsonic/frontend").IrType[],
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
  candidateMembers: readonly import("@tsonic/frontend").IrType[],
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
  memberType: import("@tsonic/frontend").IrType,
  sourceType: import("@tsonic/frontend").IrType | undefined,
  baseContext: EmitterContext
): EmitterContext => {
  const narrowedBindings = new Map(baseContext.narrowedBindings ?? []);
  narrowedBindings.set(
    originalName,
    buildExprBinding(
      buildUnionNarrowAst(receiver, memberN),
      memberType,
      sourceType,
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
  const outerNameMap = bodyCtx.localNameMap;
  const outerSemanticTypes = bodyCtx.localSemanticTypes;
  const outerValueTypes = bodyCtx.localValueTypes;
  return withScoped(
    bodyCtx,
    {
      localNameMap: new Map(outerNameMap ?? []),
      localSemanticTypes: new Map(outerSemanticTypes ?? []),
      localValueTypes: new Map(outerValueTypes ?? []),
    },
    (scopedContext) => {
      const allStatements: CSharpStatementAst[] = [...preambleStmts];

      const emitBodyStatements = (
        statements: readonly IrStatement[],
        ctx: EmitterContext
      ): EmitterContext => {
        let currentCtx = ctx;
        for (const s of statements) {
          const [stmts, next] = emitStatementAst(s, currentCtx);
          allStatements.push(...stmts);
          currentCtx = next;
        }
        return currentCtx;
      };

      const finalCtx =
        bodyStmt.kind === "blockStatement"
          ? emitBodyStatements(bodyStmt.statements, scopedContext)
          : (() => {
              const [stmts, next] = emitStatementAst(bodyStmt, scopedContext);
              allStatements.push(...stmts);
              return next;
            })();

      return [{ kind: "blockStatement", statements: allStatements }, finalCtx];
    }
  );
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
