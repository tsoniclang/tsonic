/** Property-truthiness, discriminant-equality, and negated-predicate union-narrowing guard emission. */

import { IrStatement, IrType } from "@tsonic/frontend";
import { EmitterContext, storageCarrier } from "../../../types.js";
import type { CSharpStatementAst } from "../../../core/format/backend-ast/types.js";
import type { CSharpExpressionAst } from "../../../core/format/backend-ast/types.js";
import { emitExpressionAst } from "../../../expression-emitter.js";
import { emitTypeAst } from "../../../type-emitter.js";
import { toBooleanConditionAst } from "../../../core/semantic/boolean-context.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import { makeNarrowedLocalName } from "../../../core/semantic/narrowing-keys.js";
import { buildRuntimeUnionMatchAst } from "../../../core/semantic/runtime-union-projection.js";
import { emitCSharpName } from "../../../naming-policy.js";
import {
  buildProjectedExprBinding,
  buildSubsetUnionType,
  toReceiverAst,
  buildUnionNarrowAst,
  resetBranchFlowState,
  withComplementNarrowing,
  withComplementNarrowingForMembers,
  wrapInBlock,
  emitForcedBlockWithPreambleAst,
  buildCastLocalDecl,
  buildIsNCondition,
  emitBranchScopedStatementAst,
  withoutNarrowedBinding,
} from "./branch-context.js";
import {
  tryResolvePredicateGuard,
  tryResolvePropertyExistenceGuard,
  tryResolvePropertyTruthinessGuard,
  tryResolveDiscriminantEqualityGuard,
  isDefinitelyTerminating,
} from "./guard-analysis.js";
import { tryBuildRuntimeMaterializationAst } from "../../../core/semantic/runtime-reification.js";
import type { RuntimeMaterializationSourceFrame } from "../../../core/semantic/runtime-reification.js";

type IfStatement = Extract<IrStatement, { kind: "ifStatement" }>;
type GuardResult = [readonly CSharpStatementAst[], EmitterContext] | undefined;

const buildPredicateSourceFrame = (
  runtimeUnionArity: number,
  candidateMembers: readonly IrType[],
  candidateMemberNs: readonly number[],
  sourceMembers: readonly IrType[] | undefined,
  sourceCandidateMemberNs: readonly number[] | undefined
): RuntimeMaterializationSourceFrame | undefined => {
  if (
    sourceMembers &&
    sourceCandidateMemberNs &&
    sourceMembers.length === sourceCandidateMemberNs.length
  ) {
    return {
      members: sourceMembers,
      candidateMemberNs: sourceCandidateMemberNs,
      runtimeUnionArity,
    };
  }

  return candidateMembers.length === candidateMemberNs.length
    ? {
        members: candidateMembers,
        candidateMemberNs,
        runtimeUnionArity,
      }
    : undefined;
};

const buildMaterializedPredicateNarrowLocal = (
  varName: string,
  receiverAst: CSharpExpressionAst,
  sourceType: IrType | undefined,
  fallbackSourceMembers: readonly IrType[],
  targetType: IrType,
  selectedMemberN: number,
  runtimeUnionArity: number,
  candidateMemberNs: readonly number[],
  sourceMembers: readonly IrType[] | undefined,
  sourceCandidateMemberNs: readonly number[] | undefined,
  context: EmitterContext
): [CSharpStatementAst, EmitterContext] | undefined => {
  const carrierSourceType =
    sourceType ?? buildSubsetUnionType(fallbackSourceMembers) ?? targetType;
  const materialized = tryBuildRuntimeMaterializationAst(
    receiverAst,
    carrierSourceType,
    targetType,
    context,
    emitTypeAst,
    new Set([selectedMemberN]),
    buildPredicateSourceFrame(
      runtimeUnionArity,
      fallbackSourceMembers,
      candidateMemberNs,
      sourceMembers,
      sourceCandidateMemberNs
    )
  );
  if (!materialized) {
    return undefined;
  }

  return [
    {
      kind: "localDeclarationStatement",
      modifiers: [],
      type: { kind: "varType" },
      declarators: [{ name: varName, initializer: materialized[0] }],
    },
    materialized[1],
  ];
};

const buildRuntimeUnionPropertyTruthinessCondition = (
  receiver: string,
  propertyName: string,
  wantTruthy: boolean,
  unionArity: number,
  context: EmitterContext
): CSharpExpressionAst => {
  const emittedPropertyName = emitCSharpName(
    propertyName,
    "properties",
    context
  );
  const matchAst = buildRuntimeUnionMatchAst(
    toReceiverAst(receiver),
    Array.from({ length: unionArity }, (_, index) => {
      const parameterName = `__tsonic_union_member_${index + 1}`;
      return {
        kind: "lambdaExpression" as const,
        isAsync: false,
        parameters: [{ name: parameterName }],
        body: {
          kind: "memberAccessExpression" as const,
          expression: {
            kind: "identifierExpression" as const,
            identifier: parameterName,
          },
          memberName: emittedPropertyName,
        },
      };
    }),
    [{ kind: "predefinedType", keyword: "bool" }]
  );

  return wantTruthy
    ? matchAst
    : { kind: "prefixUnaryExpression", operatorToken: "!", operand: matchAst };
};

/** Try to emit a property-truthiness guard for `if (result.success) { ... }`. */
export const tryEmitPropertyTruthinessGuard = (
  stmt: IfStatement,
  context: EmitterContext
): GuardResult => {
  const propertyTruthinessGuard = tryResolvePropertyTruthinessGuard(
    stmt.condition,
    context
  );
  if (!propertyTruthinessGuard) return undefined;

  const {
    originalName,
    propertyName,
    wantTruthy,
    memberN,
    unionArity,
    runtimeUnionArity,
    candidateMemberNs,
    candidateMembers,
    ctxWithId,
    escapedOrig,
    escapedNarrow,
    narrowedMap,
  } = propertyTruthinessGuard;

  if (
    runtimeUnionArity !== unionArity ||
    candidateMemberNs.length !== unionArity ||
    !candidateMemberNs.every(
      (candidateMemberN, index) => candidateMemberN === index + 1
    )
  ) {
    return undefined;
  }

  const condAst = buildRuntimeUnionPropertyTruthinessCondition(
    escapedOrig,
    propertyName,
    wantTruthy,
    unionArity,
    context
  );
  const castStmt = buildCastLocalDecl(escapedNarrow, escapedOrig, memberN);

  const thenCtx: EmitterContext = {
    ...ctxWithId,
    narrowedBindings: narrowedMap,
  };

  const [thenBlock, thenBodyCtx] = emitForcedBlockWithPreambleAst(
    [castStmt],
    stmt.thenStatement,
    thenCtx
  );

  const basePostConditionContext = resetBranchFlowState(ctxWithId, thenBodyCtx);
  let finalContext: EmitterContext = basePostConditionContext;
  let elseStmt: CSharpStatementAst | undefined;

  if (stmt.elseStatement) {
    if (unionArity === 2) {
      const elseCtx = withComplementNarrowing(
        originalName,
        escapedOrig,
        runtimeUnionArity,
        candidateMemberNs,
        candidateMembers,
        memberN,
        basePostConditionContext
      );

      const [elseStmts, elseCtxAfter] = emitBranchScopedStatementAst(
        stmt.elseStatement,
        elseCtx
      );
      elseStmt = wrapInBlock(elseStmts);
      finalContext = {
        ...elseCtxAfter,
        narrowedBindings: ctxWithId.narrowedBindings,
      };

      return [
        [
          {
            kind: "ifStatement",
            condition: condAst,
            thenStatement: thenBlock,
            elseStatement: elseStmt,
          },
        ],
        finalContext,
      ];
    }

    const [elseStmts, elseCtx] = emitBranchScopedStatementAst(
      stmt.elseStatement,
      {
        ...basePostConditionContext,
        narrowedBindings: ctxWithId.narrowedBindings,
      }
    );
    elseStmt = wrapInBlock(elseStmts);
    finalContext = {
      ...elseCtx,
      narrowedBindings: ctxWithId.narrowedBindings,
    };

    return [
      [
        {
          kind: "ifStatement",
          condition: condAst,
          thenStatement: thenBlock,
          elseStatement: elseStmt,
        },
      ],
      finalContext,
    ];
  }

  if (isDefinitelyTerminating(stmt.thenStatement)) {
    finalContext = withComplementNarrowing(
      originalName,
      escapedOrig,
      runtimeUnionArity,
      candidateMemberNs,
      candidateMembers,
      memberN,
      basePostConditionContext
    );
    return [
      [{ kind: "ifStatement", condition: condAst, thenStatement: thenBlock }],
      finalContext,
    ];
  }

  finalContext = {
    ...finalContext,
    narrowedBindings: ctxWithId.narrowedBindings,
  };
  return [
    [{ kind: "ifStatement", condition: condAst, thenStatement: thenBlock }],
    finalContext,
  ];
};

/** Try to emit a property-existence guard for `"error" in result`. */
export const tryEmitPropertyExistenceGuard = (
  stmt: IfStatement,
  context: EmitterContext
): GuardResult => {
  const propertyExistenceGuard = tryResolvePropertyExistenceGuard(
    stmt.condition,
    context
  );
  if (!propertyExistenceGuard) return undefined;

  const {
    originalName,
    memberN,
    unionArity,
    runtimeUnionArity,
    candidateMemberNs,
    candidateMembers,
    ctxWithId,
    escapedOrig,
    escapedNarrow,
    narrowedMap,
  } = propertyExistenceGuard;

  const condAst = buildIsNCondition(escapedOrig, memberN, false);
  const castStmt = buildCastLocalDecl(escapedNarrow, escapedOrig, memberN);
  const thenCtx: EmitterContext = {
    ...ctxWithId,
    narrowedBindings: narrowedMap,
  };
  const [thenBlock, thenBodyCtx] = emitForcedBlockWithPreambleAst(
    [castStmt],
    stmt.thenStatement,
    thenCtx
  );
  const basePostConditionContext = resetBranchFlowState(ctxWithId, thenBodyCtx);
  let finalContext: EmitterContext = basePostConditionContext;
  let elseStmt: CSharpStatementAst | undefined;

  if (stmt.elseStatement) {
    if (unionArity === 2) {
      const elseCtx = withComplementNarrowing(
        originalName,
        escapedOrig,
        runtimeUnionArity,
        candidateMemberNs,
        candidateMembers,
        memberN,
        basePostConditionContext
      );
      const [elseStmts, elseCtxAfter] = emitBranchScopedStatementAst(
        stmt.elseStatement,
        elseCtx
      );
      elseStmt = wrapInBlock(elseStmts);
      finalContext = {
        ...elseCtxAfter,
        narrowedBindings: ctxWithId.narrowedBindings,
      };
      return [
        [
          {
            kind: "ifStatement",
            condition: condAst,
            thenStatement: thenBlock,
            elseStatement: elseStmt,
          },
        ],
        finalContext,
      ];
    }

    const [elseStmts, elseCtx] = emitBranchScopedStatementAst(
      stmt.elseStatement,
      {
        ...basePostConditionContext,
        narrowedBindings: ctxWithId.narrowedBindings,
      }
    );
    elseStmt = wrapInBlock(elseStmts);
    finalContext = {
      ...elseCtx,
      narrowedBindings: ctxWithId.narrowedBindings,
    };
    return [
      [
        {
          kind: "ifStatement",
          condition: condAst,
          thenStatement: thenBlock,
          elseStatement: elseStmt,
        },
      ],
      finalContext,
    ];
  }

  if (isDefinitelyTerminating(stmt.thenStatement)) {
    finalContext = withComplementNarrowing(
      originalName,
      escapedOrig,
      runtimeUnionArity,
      candidateMemberNs,
      candidateMembers,
      memberN,
      basePostConditionContext
    );
    return [
      [{ kind: "ifStatement", condition: condAst, thenStatement: thenBlock }],
      finalContext,
    ];
  }

  finalContext = {
    ...finalContext,
    narrowedBindings: ctxWithId.narrowedBindings,
  };
  return [
    [{ kind: "ifStatement", condition: condAst, thenStatement: thenBlock }],
    finalContext,
  ];
};

/**
 * Try to emit a discriminant-equality guard narrowing for
 * `if (shape.kind === "circle") { ... }`.
 * Returns undefined if the condition is not a matching discriminant-equality guard.
 */
export const tryEmitDiscriminantEqualityGuard = (
  stmt: IfStatement,
  context: EmitterContext
): GuardResult => {
  const eqGuard = tryResolveDiscriminantEqualityGuard(stmt.condition, context);
  if (!eqGuard) return undefined;

  const {
    originalName,
    receiverExpr,
    operator,
    memberN,
    unionArity,
    runtimeUnionArity,
    candidateMemberNs,
    candidateMembers,
    ctxWithId,
    escapedNarrow,
    narrowedMap,
  } = eqGuard;

  const [receiverAst, receiverContext] = emitExpressionAst(
    receiverExpr,
    withoutNarrowedBinding(ctxWithId, originalName)
  );
  const guardContext: EmitterContext = {
    ...receiverContext,
    tempVarId: ctxWithId.tempVarId,
    narrowedBindings: ctxWithId.narrowedBindings,
  };
  const isInequality = operator === "!==" || operator === "!=";
  const condAst = buildIsNCondition(receiverAst, memberN, isInequality);

  let finalContext: EmitterContext = guardContext;

  // Equality: narrow THEN to memberN. Inequality: narrow ELSE to memberN.
  if (!isInequality) {
    const castStmt = buildCastLocalDecl(escapedNarrow, receiverAst, memberN);
    const thenCtx: EmitterContext = {
      ...guardContext,
      narrowedBindings: narrowedMap,
    };
    const [thenBlock, thenBodyCtx] = emitForcedBlockWithPreambleAst(
      [castStmt],
      stmt.thenStatement,
      thenCtx
    );
    const basePostConditionContext = resetBranchFlowState(
      guardContext,
      thenBodyCtx
    );
    finalContext = basePostConditionContext;

    let elseStmt: CSharpStatementAst | undefined;
    if (stmt.elseStatement) {
      if (unionArity === 2) {
        const [elseStmts, elseCtxAfter] = emitBranchScopedStatementAst(
          stmt.elseStatement,
          withComplementNarrowing(
            originalName,
            receiverAst,
            runtimeUnionArity,
            candidateMemberNs,
            candidateMembers,
            memberN,
            basePostConditionContext
          )
        );
        elseStmt = wrapInBlock(elseStmts);
        finalContext = {
          ...elseCtxAfter,
          narrowedBindings: ctxWithId.narrowedBindings,
        };
        return [
          [
            {
              kind: "ifStatement",
              condition: condAst,
              thenStatement: thenBlock,
              elseStatement: elseStmt,
            },
          ],
          finalContext,
        ];
      }

      const [elseStmts, elseCtx] = emitBranchScopedStatementAst(
        stmt.elseStatement,
        {
          ...basePostConditionContext,
          narrowedBindings: ctxWithId.narrowedBindings,
        }
      );
      elseStmt = wrapInBlock(elseStmts);
      finalContext = {
        ...elseCtx,
        narrowedBindings: ctxWithId.narrowedBindings,
      };
      return [
        [
          {
            kind: "ifStatement",
            condition: condAst,
            thenStatement: thenBlock,
            elseStatement: elseStmt,
          },
        ],
        finalContext,
      ];
    }

    // Post-if narrowing for early-exit patterns (2-member unions only)
    if (isDefinitelyTerminating(stmt.thenStatement)) {
      finalContext = withComplementNarrowing(
        originalName,
        receiverAst,
        runtimeUnionArity,
        candidateMemberNs,
        candidateMembers,
        memberN,
        basePostConditionContext
      );
      return [
        [
          {
            kind: "ifStatement",
            condition: condAst,
            thenStatement: thenBlock,
          },
        ],
        finalContext,
      ];
    }

    finalContext = {
      ...finalContext,
      narrowedBindings: ctxWithId.narrowedBindings,
    };
    return [
      [{ kind: "ifStatement", condition: condAst, thenStatement: thenBlock }],
      finalContext,
    ];
  }

  // Inequality: THEN is "not memberN", ELSE is memberN
  {
    let thenStmt: CSharpStatementAst;
    let thenCtx: EmitterContext;

    if (unionArity === 2) {
      const [thenStmts, thenCtxAfter] = emitBranchScopedStatementAst(
        stmt.thenStatement,
        {
          ...withComplementNarrowing(
            originalName,
            receiverAst,
            runtimeUnionArity,
            candidateMemberNs,
            candidateMembers,
            memberN,
            guardContext
          ),
        }
      );
      thenStmt = wrapInBlock(thenStmts);
      thenCtx = thenCtxAfter;
    } else {
      const [thenStmts, thenCtxAfter] = emitBranchScopedStatementAst(
        stmt.thenStatement,
        guardContext
      );
      thenStmt = wrapInBlock(thenStmts);
      thenCtx = thenCtxAfter;
    }

    finalContext = thenCtx;

    let elseStmt: CSharpStatementAst | undefined;
    if (stmt.elseStatement) {
      const castStmt = buildCastLocalDecl(escapedNarrow, receiverAst, memberN);
      const [elseBlock, elseBodyCtx] = emitForcedBlockWithPreambleAst(
        [castStmt],
        stmt.elseStatement,
        { ...guardContext, narrowedBindings: narrowedMap }
      );
      elseStmt = elseBlock;
      finalContext = {
        ...elseBodyCtx,
        narrowedBindings: ctxWithId.narrowedBindings,
      };
      return [
        [
          {
            kind: "ifStatement",
            condition: condAst,
            thenStatement: thenStmt,
            elseStatement: elseStmt,
          },
        ],
        finalContext,
      ];
    }

    // Post-if narrowing for early-exit patterns
    if (isDefinitelyTerminating(stmt.thenStatement)) {
      const narrowedBindings = new Map(finalContext.narrowedBindings ?? []);
      narrowedBindings.set(
        originalName,
        buildProjectedExprBinding(
          buildUnionNarrowAst(receiverAst, memberN),
          candidateMembers[
            candidateMemberNs.findIndex(
              (runtimeMemberN) => runtimeMemberN === memberN
            )
          ],
          undefined,
          toReceiverAst(receiverAst)
        )
      );
      finalContext = { ...finalContext, narrowedBindings };
      return [
        [
          {
            kind: "ifStatement",
            condition: condAst,
            thenStatement: thenStmt,
          },
        ],
        finalContext,
      ];
    }

    finalContext = {
      ...finalContext,
      narrowedBindings: ctxWithId.narrowedBindings,
    };
    return [
      [{ kind: "ifStatement", condition: condAst, thenStatement: thenStmt }],
      finalContext,
    ];
  }
};

/**
 * Try to emit a negated predicate guard narrowing for
 * `if (!isUser(account)) { ... }`.
 * Returns undefined if the condition is not a matching negated predicate call.
 */
export const tryEmitNegatedPredicateGuard = (
  stmt: IfStatement,
  context: EmitterContext
): GuardResult => {
  const thenStatement = stmt.thenStatement;
  if (!thenStatement) {
    return undefined;
  }

  if (
    stmt.condition.kind !== "unary" ||
    stmt.condition.operator !== "!" ||
    stmt.condition.expression.kind !== "call"
  ) {
    return undefined;
  }

  const innerCall = stmt.condition.expression;
  const guard = tryResolvePredicateGuard(innerCall, context);
  if (!guard) return undefined;

  const {
    originalName,
    receiverAst,
    memberN,
    memberNs,
    unionArity,
    runtimeUnionArity,
    candidateMemberNs,
    candidateMembers,
    ctxWithId,
    escapedNarrow,
    narrowedMap,
    targetType,
    sourceType,
    sourceMembers,
    sourceCandidateMemberNs,
  } = guard;

  const [predicateCallAst, predicateCallContext] = emitExpressionAst(
    stmt.condition,
    context
  );
  const [condAst, conditionContext] = toBooleanConditionAst(
    stmt.condition,
    predicateCallAst,
    predicateCallContext
  );

  // THEN branch: for 2-member unions narrow to OTHER member
  let thenStmt: CSharpStatementAst;
  let thenCtx: EmitterContext;

  if (memberNs.length === 1 && unionArity === 2 && memberN !== undefined) {
    const otherIndex = candidateMemberNs.findIndex(
      (runtimeMemberN) => runtimeMemberN !== memberN
    );
    const otherMemberN =
      otherIndex >= 0 ? candidateMemberNs[otherIndex] : undefined;
    const otherMemberType =
      otherIndex >= 0 ? candidateMembers[otherIndex] : undefined;
    if (!otherMemberN || !otherMemberType) {
      throw new Error(
        "ICE: Failed to resolve complement runtime union member for negated predicate guard."
      );
    }
    const nextId = (conditionContext.tempVarId ?? 0) + 1;
    const thenCtxWithId: EmitterContext = {
      ...conditionContext,
      tempVarId: nextId,
    };

    const thenNarrowedName = makeNarrowedLocalName(
      originalName,
      otherMemberN,
      nextId
    );
    const escapedThenNarrow = escapeCSharpIdentifier(thenNarrowedName);

    const thenNarrowedMap = new Map(thenCtxWithId.narrowedBindings ?? []);
    thenNarrowedMap.set(originalName, {
      kind: "rename",
      name: thenNarrowedName,
      type: otherMemberType,
      sourceType: sourceType ?? buildSubsetUnionType(candidateMembers),
    });

    const [thenCastStmt, thenMaterializedContext] =
      buildMaterializedPredicateNarrowLocal(
        escapedThenNarrow,
        receiverAst,
        sourceType,
        candidateMembers,
        otherMemberType,
        otherMemberN,
        runtimeUnionArity,
        candidateMemberNs,
        sourceMembers,
        sourceCandidateMemberNs,
        thenCtxWithId
      ) ?? [
        buildCastLocalDecl(escapedThenNarrow, receiverAst, otherMemberN),
        thenCtxWithId,
      ];
    const thenLocalValueTypes = new Map(
      thenMaterializedContext.localValueTypes ?? []
    );
    thenLocalValueTypes.set(thenNarrowedName, storageCarrier(otherMemberType));
    if (escapedThenNarrow !== thenNarrowedName) {
      thenLocalValueTypes.set(
        escapedThenNarrow,
        storageCarrier(otherMemberType)
      );
    }

    const [thenBlock, thenBlockCtx] = emitForcedBlockWithPreambleAst(
      [thenCastStmt],
      thenStatement,
      {
        ...thenMaterializedContext,
        localValueTypes: thenLocalValueTypes,
        narrowedBindings: thenNarrowedMap,
      }
    );
    thenStmt = thenBlock;
    thenCtx = thenBlockCtx;
  } else {
    const [thenStmts, thenCtxAfter] = emitBranchScopedStatementAst(
      thenStatement,
      withComplementNarrowingForMembers(
        originalName,
        receiverAst,
        runtimeUnionArity,
        candidateMemberNs,
        candidateMembers,
        memberNs,
        conditionContext
      )
    );
    thenStmt = wrapInBlock(thenStmts);
    thenCtx = thenCtxAfter;
  }

  if (stmt.elseStatement) {
    const [elseBlock, _elseBodyCtx] =
      memberN !== undefined
        ? emitForcedBlockWithPreambleAst(
            [buildCastLocalDecl(escapedNarrow, receiverAst, memberN)],
            stmt.elseStatement,
            { ...conditionContext, narrowedBindings: narrowedMap }
          )
        : (() => {
            const narrowedBindings = new Map(
              conditionContext.narrowedBindings ?? []
            );
            narrowedBindings.set(originalName, {
              kind: "runtimeSubset",
              runtimeMemberNs: memberNs,
              runtimeUnionArity,
              storageExprAst: receiverAst,
              sourceMembers: sourceMembers ? [...sourceMembers] : undefined,
              sourceCandidateMemberNs: sourceCandidateMemberNs
                ? [...sourceCandidateMemberNs]
                : undefined,
              type: targetType,
              sourceType: sourceType ?? buildSubsetUnionType(candidateMembers),
            });
            const [elseStmts, nextElseCtx] = emitBranchScopedStatementAst(
              stmt.elseStatement,
              {
                ...conditionContext,
                narrowedBindings,
              }
            );
            return [wrapInBlock(elseStmts), nextElseCtx] as const;
          })();

    return [
      [
        {
          kind: "ifStatement",
          condition: condAst,
          thenStatement: thenStmt,
          elseStatement: elseBlock,
        },
      ],
      thenCtx,
    ];
  }

  let finalContext = thenCtx;
  if (isDefinitelyTerminating(thenStatement)) {
    const narrowedBindings = new Map(finalContext.narrowedBindings ?? []);
    if (memberN !== undefined) {
      const selectedIndex = candidateMemberNs.findIndex(
        (runtimeMemberN) => runtimeMemberN === memberN
      );
      const selectedMemberType =
        selectedIndex >= 0 ? candidateMembers[selectedIndex] : undefined;
      if (!selectedMemberType) {
        throw new Error(
          "ICE: Failed to resolve predicate target runtime union member for negated predicate fallthrough."
        );
      }

      const carrierSourceType =
        sourceType ?? buildSubsetUnionType(candidateMembers) ?? selectedMemberType;
      const sourceFrame = buildPredicateSourceFrame(
        runtimeUnionArity,
        candidateMembers,
        candidateMemberNs,
        sourceMembers,
        sourceCandidateMemberNs
      );
      const materialized = tryBuildRuntimeMaterializationAst(
        receiverAst,
        carrierSourceType,
        selectedMemberType,
        finalContext,
        emitTypeAst,
        new Set([memberN]),
        sourceFrame
      );
      const narrowedExprAst =
        materialized?.[0] ?? buildUnionNarrowAst(receiverAst, memberN);
      if (materialized) {
        finalContext = materialized[1];
      }

      narrowedBindings.set(
        originalName,
        buildProjectedExprBinding(
          narrowedExprAst,
          selectedMemberType,
          carrierSourceType,
          toReceiverAst(receiverAst),
          undefined,
          carrierSourceType
        )
      );
    } else {
      narrowedBindings.set(originalName, {
        kind: "runtimeSubset",
        runtimeMemberNs: memberNs,
        runtimeUnionArity,
        storageExprAst: receiverAst,
        sourceMembers: sourceMembers ? [...sourceMembers] : undefined,
        sourceCandidateMemberNs: sourceCandidateMemberNs
          ? [...sourceCandidateMemberNs]
          : undefined,
        type: targetType,
        sourceType: sourceType ?? buildSubsetUnionType(candidateMembers),
      });
    }

    finalContext = { ...finalContext, narrowedBindings };
    return [
      [{ kind: "ifStatement", condition: condAst, thenStatement: thenStmt }],
      finalContext,
    ];
  }

  finalContext = {
    ...finalContext,
    narrowedBindings: ctxWithId.narrowedBindings,
  };
  return [
    [{ kind: "ifStatement", condition: condAst, thenStatement: thenStmt }],
    finalContext,
  ];
};
