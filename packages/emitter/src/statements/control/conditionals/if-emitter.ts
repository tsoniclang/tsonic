/**
 * If-statement emitter with union/instanceof/nullable guard narrowing.
 * Returns CSharpStatementAst nodes.
 */

import {
  IrExpression,
  IrStatement,
  IrType,
  normalizedUnionType,
} from "@tsonic/frontend";
import { EmitterContext, NarrowedBinding } from "../../../types.js";
import { emitExpressionAst } from "../../../expression-emitter.js";
import { emitIdentifier } from "../../../expressions/identifiers.js";
import { emitTypeAst } from "../../../type-emitter.js";
import type {
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpBlockStatementAst,
  CSharpTypeAst,
} from "../../../core/format/backend-ast/types.js";
import { emitStatementAst } from "../../../statement-emitter.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import {
  makeNarrowedLocalName,
  getMemberAccessNarrowKey,
} from "../../../core/semantic/narrowing-keys.js";
import {
  narrowTypeByTypeofTag,
  narrowTypeByNotTypeofTag,
  matchesTypeofTag,
  resolveTypeAlias,
  stripNullish,
} from "../../../core/semantic/type-resolution.js";
import { isAssignable } from "../../../core/semantic/index.js";
import {
  emitBooleanConditionAst,
  toBooleanConditionAst,
  type EmitExprAstFn,
} from "../../../core/semantic/boolean-context.js";
import { applyConditionBranchNarrowing } from "../../../core/semantic/condition-branch-narrowing.js";
import { unwrapTransparentNarrowingTarget } from "../../../core/semantic/transparent-expressions.js";
import {
  tryResolvePredicateGuard,
  tryResolveInstanceofGuard,
  tryResolveInGuard,
  tryResolveDiscriminantEqualityGuard,
  tryResolvePropertyTruthinessGuard,
  tryResolveSimpleNullableGuard,
  tryResolveNullableGuard,
  isDefinitelyTerminating,
  resolveRuntimeUnionFrame,
} from "./guard-analysis.js";
import { withScoped } from "../../../emitter-types/context.js";

/** Standard emitExpressionAst adapter for emitBooleanConditionAst callback. */
const emitExprAstCb: EmitExprAstFn = (e, ctx) => emitExpressionAst(e, ctx);

const mergeBranchContextMeta = (
  preferred: EmitterContext,
  alternate: EmitterContext
): EmitterContext => ({
  ...preferred,
  tempVarId: Math.max(preferred.tempVarId ?? 0, alternate.tempVarId ?? 0),
  usings: new Set([...(preferred.usings ?? []), ...(alternate.usings ?? [])]),
});

const resetBranchFlowState = (
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

const toReceiverAst = (
  receiver: string | CSharpExpressionAst
): CSharpExpressionAst =>
  typeof receiver === "string"
    ? { kind: "identifierExpression", identifier: receiver }
    : receiver;

const buildExprBinding = (
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
const buildUnionNarrowAst = (
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

const buildSubsetUnionType = (
  members: readonly import("@tsonic/frontend").IrType[]
): import("@tsonic/frontend").IrType | undefined => {
  if (members.length === 0) return undefined;
  if (members.length === 1) return members[0];
  return normalizedUnionType(members);
};

const buildComplementNarrowedBinding = (
  receiver: string | CSharpExpressionAst,
  runtimeUnionArity: number,
  candidateMemberNs: readonly number[],
  candidateMembers: readonly import("@tsonic/frontend").IrType[],
  selectedMemberN: number,
  sourceType?: import("@tsonic/frontend").IrType
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
    sourceMembers: [...candidateMembers],
    sourceCandidateMemberNs: [...candidateMemberNs],
    type: buildSubsetUnionType(remainingPairs.map((pair) => pair.memberType)),
    sourceType,
  };
};

const isArrayLikeNarrowingCandidate = (
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
      resolved.name === "ReadonlyArray" ||
      resolved.name === "JSArray")
  ) {
    return true;
  }
  return false;
};

const narrowTypeByArrayShape = (
  currentType: IrType | undefined,
  wantArray: boolean,
  context: EmitterContext
): IrType | undefined => {
  if (!currentType) return undefined;

  const resolved = resolveTypeAlias(stripNullish(currentType), context);
  if (resolved.kind === "unionType") {
    const kept = resolved.types.filter((member): member is IrType => {
      if (!member) return false;
      const isArrayLike = isArrayLikeNarrowingCandidate(member, context);
      return wantArray ? isArrayLike : !isArrayLike;
    });
    if (kept.length === 0) return undefined;
    if (kept.length === 1) return kept[0];
    return normalizedUnionType(kept);
  }

  const isArrayLike = isArrayLikeNarrowingCandidate(resolved, context);
  if (wantArray) {
    return isArrayLike ? resolved : undefined;
  }
  return isArrayLike ? undefined : resolved;
};

const narrowTypeByNotAssignableTarget = (
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
      const resolvedMember = resolveTypeAlias(stripNullish(member), context);
      return !isAssignable(resolvedMember, resolvedTarget);
    });
    if (kept.length === 0) return undefined;
    if (kept.length === 1) return kept[0];
    return normalizedUnionType(kept);
  }

  return isAssignable(resolvedCurrent, resolvedTarget)
    ? undefined
    : resolvedCurrent;
};

const applyExprFallthroughNarrowing = (
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

const withoutNarrowedBinding = (
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

const tryExtractArrayIsArrayGuard = (
  condition: Extract<IrStatement, { kind: "ifStatement" }>["condition"]
):
  | {
      readonly originalName: string;
      readonly targetExpr: Extract<
        IrExpression,
        { kind: "identifier" | "memberAccess" }
      >;
      readonly narrowsInThen: boolean;
    }
  | undefined => {
  const extractDirect = (
    expr: typeof condition
  ):
    | {
        readonly originalName: string;
        readonly targetExpr: Extract<
          IrExpression,
          { kind: "identifier" | "memberAccess" }
        >;
        readonly narrowsInThen: boolean;
      }
    | undefined => {
    if (expr.kind !== "call") return undefined;
    if (expr.arguments.length !== 1) return undefined;
    if (expr.callee.kind !== "memberAccess" || expr.callee.isComputed) {
      return undefined;
    }
    if (expr.callee.property !== "isArray") return undefined;
    if (
      expr.callee.object.kind !== "identifier" ||
      expr.callee.object.name !== "Array"
    ) {
      return undefined;
    }

    const [rawTarget] = expr.arguments;
    if (!rawTarget) return undefined;
    const target = unwrapTransparentNarrowingTarget(rawTarget);
    if (!target) return undefined;

    const originalName =
      target.kind === "identifier"
        ? target.name
        : getMemberAccessNarrowKey(target);
    if (!originalName) return undefined;

    return {
      originalName,
      targetExpr: target,
      narrowsInThen: true,
    };
  };

  const direct = extractDirect(condition);
  if (direct) return direct;

  if (condition.kind === "unary" && condition.operator === "!") {
    const inner = extractDirect(condition.expression);
    if (inner) {
      return {
        ...inner,
        narrowsInThen: false,
      };
    }
  }

  return undefined;
};

const withComplementNarrowing = (
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
  const binding = buildComplementNarrowedBinding(
    receiver,
    runtimeUnionArity,
    candidateMemberNs,
    candidateMembers,
    selectedMemberN,
    sourceType
  );

  if (!binding) {
    return baseContext;
  }

  const narrowedBindings = new Map(baseContext.narrowedBindings ?? []);
  narrowedBindings.set(originalName, binding);
  return { ...baseContext, narrowedBindings };
};

const withRuntimeUnionMemberNarrowing = (
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
const wrapInBlock = (
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
const emitForcedBlockWithPreambleAst = (
  preambleStmts: readonly CSharpStatementAst[],
  bodyStmt: IrStatement,
  bodyCtx: EmitterContext
): [CSharpBlockStatementAst, EmitterContext] => {
  const outerNameMap = bodyCtx.localNameMap;
  const outerValueTypes = bodyCtx.localValueTypes;
  return withScoped(
    bodyCtx,
    {
      localNameMap: new Map(outerNameMap ?? []),
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
const buildCastLocalDecl = (
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
const buildIsNCondition = (
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

/**
 * Build the condition expression `orig is TypeName varName`.
 */
const buildIsPatternCondition = (
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

type TypeofGuardRefinement = {
  readonly bindingKey: string;
  readonly targetExpr: Extract<
    import("@tsonic/frontend").IrExpression,
    { kind: "identifier" | "memberAccess" }
  >;
  readonly tag: string;
  readonly matchTag: boolean;
};

const tryExtractDirectTypeofGuard = (
  expr: Extract<IrStatement, { kind: "ifStatement" }>["condition"]
):
  | {
      readonly bindingKey: string;
      readonly targetExpr: Extract<
        import("@tsonic/frontend").IrExpression,
        { kind: "identifier" | "memberAccess" }
      >;
      readonly tag: string;
      readonly matchesInTruthyBranch: boolean;
    }
  | undefined => {
  if (expr.kind !== "binary") return undefined;
  if (
    expr.operator !== "===" &&
    expr.operator !== "==" &&
    expr.operator !== "!==" &&
    expr.operator !== "!="
  ) {
    return undefined;
  }

  const extract = (
    left: typeof expr.left,
    right: typeof expr.right
  ):
    | {
        readonly bindingKey: string;
        readonly targetExpr: Extract<
          import("@tsonic/frontend").IrExpression,
          { kind: "identifier" | "memberAccess" }
        >;
        readonly tag: string;
      }
    | undefined => {
    if (left.kind !== "unary" || left.operator !== "typeof") return undefined;
    const target = unwrapTransparentNarrowingTarget(left.expression);
    if (!target) return undefined;
    if (right.kind !== "literal" || typeof right.value !== "string") {
      return undefined;
    }
    const bindingKey =
      target.kind === "identifier"
        ? target.name
        : getMemberAccessNarrowKey(target);
    if (!bindingKey) return undefined;
    return {
      bindingKey,
      targetExpr: target,
      tag: right.value,
    };
  };

  const directGuard =
    extract(expr.left, expr.right) ?? extract(expr.right, expr.left);
  if (!directGuard) return undefined;

  return {
    ...directGuard,
    matchesInTruthyBranch: expr.operator === "===" || expr.operator === "==",
  };
};

const collectTypeofGuardRefinements = (
  condition: Extract<IrStatement, { kind: "ifStatement" }>["condition"],
  branch: "truthy" | "falsy"
): readonly TypeofGuardRefinement[] => {
  const direct = tryExtractDirectTypeofGuard(condition);
  if (direct) {
    return [
      {
        bindingKey: direct.bindingKey,
        targetExpr: direct.targetExpr,
        tag: direct.tag,
        matchTag:
          branch === "truthy"
            ? direct.matchesInTruthyBranch
            : !direct.matchesInTruthyBranch,
      },
    ];
  }

  if (condition.kind !== "logical") {
    return [];
  }

  if (branch === "truthy" && condition.operator === "&&") {
    return [
      ...collectTypeofGuardRefinements(condition.left, branch),
      ...collectTypeofGuardRefinements(condition.right, branch),
    ];
  }

  if (branch === "falsy" && condition.operator === "||") {
    return [
      ...collectTypeofGuardRefinements(condition.left, branch),
      ...collectTypeofGuardRefinements(condition.right, branch),
    ];
  }

  return [];
};

const applyTypeofGuardRefinements = (
  baseContext: EmitterContext,
  refinements: readonly TypeofGuardRefinement[]
): EmitterContext => {
  let currentContext = baseContext;

  for (const refinement of refinements) {
    const currentType =
      currentContext.narrowedBindings?.get(refinement.bindingKey)?.type ??
      refinement.targetExpr.inferredType;
    const narrowedType = refinement.matchTag
      ? narrowTypeByTypeofTag(currentType, refinement.tag, currentContext)
      : narrowTypeByNotTypeofTag(currentType, refinement.tag, currentContext);
    if (!narrowedType) {
      continue;
    }

    const [rawTargetAst, rawTargetContext] = emitExpressionAst(
      refinement.targetExpr,
      withoutNarrowedBinding(currentContext, refinement.bindingKey)
    );

    const runtimeUnionFrame =
      currentType &&
      resolveRuntimeUnionFrame(
        refinement.bindingKey,
        currentType,
        rawTargetContext
      );
    const matchingRuntimeMemberIndex =
      runtimeUnionFrame?.members.findIndex((member) =>
        matchesTypeofTag(member, refinement.tag, rawTargetContext)
      ) ?? -1;

    const nextBindings = new Map(rawTargetContext.narrowedBindings ?? []);

    if (
      runtimeUnionFrame &&
      matchingRuntimeMemberIndex >= 0 &&
      runtimeUnionFrame.members.filter((member) =>
        matchesTypeofTag(member, refinement.tag, rawTargetContext)
      ).length === 1
    ) {
      const memberN =
        runtimeUnionFrame.candidateMemberNs[matchingRuntimeMemberIndex] ??
        matchingRuntimeMemberIndex + 1;
      const memberType =
        runtimeUnionFrame.members[matchingRuntimeMemberIndex] ?? narrowedType;

      if (refinement.matchTag) {
        nextBindings.set(
          refinement.bindingKey,
          buildExprBinding(
            buildUnionNarrowAst(rawTargetAst, memberN),
            memberType,
            currentType,
            rawTargetAst
          )
        );
        currentContext = {
          ...rawTargetContext,
          narrowedBindings: nextBindings,
        };
        continue;
      }

      const complementBinding = buildComplementNarrowedBinding(
        rawTargetAst,
        runtimeUnionFrame.runtimeUnionArity,
        runtimeUnionFrame.candidateMemberNs,
        runtimeUnionFrame.members,
        memberN,
        currentType
      );
      if (complementBinding) {
        nextBindings.set(refinement.bindingKey, complementBinding);
        currentContext = {
          ...rawTargetContext,
          narrowedBindings: nextBindings,
        };
        continue;
      }
    }

    const [narrowedTypeAst, nextContext] = emitTypeAst(
      narrowedType,
      rawTargetContext
    );
    nextBindings.set(
      refinement.bindingKey,
      buildExprBinding(
        {
          kind: "castExpression",
          type: narrowedTypeAst,
          expression: rawTargetAst,
        },
        narrowedType,
        undefined,
        rawTargetAst
      )
    );
    currentContext = {
      ...nextContext,
      narrowedBindings: nextBindings,
    };
  }

  return currentContext;
};

/**
 * Emit an if statement as AST
 */
export const emitIfStatementAst = (
  stmt: Extract<IrStatement, { kind: "ifStatement" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  // Case A: if (isUser(account)) { ... }
  // Predicate narrowing rewrite → if (account.IsN()) { var account__N_k = account.AsN(); ... }
  if (stmt.condition.kind === "call") {
    const guard = tryResolvePredicateGuard(stmt.condition, context);
    if (guard) {
      const {
        originalName,
        receiverAst,
        memberN,
        unionArity,
        runtimeUnionArity,
        candidateMemberNs,
        candidateMembers,
        ctxWithId,
        escapedNarrow,
        narrowedMap,
      } = guard;

      const condAst = buildIsNCondition(receiverAst, memberN, false);
      const castStmt = buildCastLocalDecl(escapedNarrow, receiverAst, memberN);

      const thenCtx: EmitterContext = {
        ...ctxWithId,
        narrowedBindings: narrowedMap,
      };

      const [thenBlock, thenBodyCtx] = emitForcedBlockWithPreambleAst(
        [castStmt],
        stmt.thenStatement,
        thenCtx
      );

      let finalContext: EmitterContext = {
        ...thenBodyCtx,
        narrowedBindings: ctxWithId.narrowedBindings,
      };

      let elseStmt: CSharpStatementAst | undefined;
      if (stmt.elseStatement) {
        const elseCtxBase =
          unionArity === 2
            ? withComplementNarrowing(
                originalName,
                receiverAst,
                runtimeUnionArity,
                candidateMemberNs,
                candidateMembers,
                memberN,
                finalContext
              )
            : finalContext;
        const [elseStmts, elseCtx] = emitStatementAst(
          stmt.elseStatement,
          elseCtxBase
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
          receiverAst,
          runtimeUnionArity,
          candidateMemberNs,
          candidateMembers,
          memberN,
          finalContext
        );
      }

      const ifStmt: CSharpStatementAst = {
        kind: "ifStatement",
        condition: condAst,
        thenStatement: thenBlock,
        elseStatement: elseStmt,
      };

      return [[ifStmt], finalContext];
    }
  }

  // Case A3: if ("error" in auth) { ... }
  // Union 'in' narrowing rewrite → if (auth.IsN()) { var auth__N_k = auth.AsN(); ... }
  const inGuard = tryResolveInGuard(stmt.condition, context);
  if (inGuard) {
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
    } = inGuard;

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

    let finalContext: EmitterContext = thenBodyCtx;

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
          finalContext
        );

        const [elseStmts, elseCtxAfter] = emitStatementAst(
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

      // Can't narrow ELSE safely, emit without narrowing.
      const [elseStmts, elseCtx] = emitStatementAst(stmt.elseStatement, {
        ...finalContext,
        narrowedBindings: ctxWithId.narrowedBindings,
      });
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
        escapedOrig,
        runtimeUnionArity,
        candidateMemberNs,
        candidateMembers,
        memberN,
        finalContext
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
  }

  // Case A3b: if (result.success) { ... } / if (!result.success) { ... }
  // Truthy/falsy discriminant narrowing over runtime unions.
  const propertyTruthinessGuard = tryResolvePropertyTruthinessGuard(
    stmt.condition,
    context
  );
  if (propertyTruthinessGuard) {
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
    } = propertyTruthinessGuard;

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

    let finalContext: EmitterContext = thenBodyCtx;
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
          finalContext
        );

        const [elseStmts, elseCtxAfter] = emitStatementAst(
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

      const [elseStmts, elseCtx] = emitStatementAst(stmt.elseStatement, {
        ...finalContext,
        narrowedBindings: ctxWithId.narrowedBindings,
      });
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
        finalContext
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
  }

  // Case A4: if (shape.kind === "circle") { ... }
  // Discriminant literal equality narrowing
  const eqGuard = tryResolveDiscriminantEqualityGuard(stmt.condition, context);
  if (eqGuard) {
    const {
      originalName,
      operator,
      memberN,
      unionArity,
      runtimeUnionArity,
      candidateMemberNs,
      candidateMembers,
      ctxWithId,
      escapedOrig,
      escapedNarrow,
      narrowedMap,
    } = eqGuard;

    const isInequality = operator === "!==" || operator === "!=";
    const condAst = buildIsNCondition(escapedOrig, memberN, isInequality);

    let finalContext: EmitterContext = ctxWithId;

    // Equality: narrow THEN to memberN. Inequality: narrow ELSE to memberN.
    if (!isInequality) {
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
      finalContext = thenBodyCtx;

      let elseStmt: CSharpStatementAst | undefined;
      if (stmt.elseStatement) {
        if (unionArity === 2) {
          const [elseStmts, elseCtxAfter] = emitStatementAst(
            stmt.elseStatement,
            withComplementNarrowing(
              originalName,
              escapedOrig,
              runtimeUnionArity,
              candidateMemberNs,
              candidateMembers,
              memberN,
              finalContext
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

        const [elseStmts, elseCtx] = emitStatementAst(stmt.elseStatement, {
          ...finalContext,
          narrowedBindings: ctxWithId.narrowedBindings,
        });
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
          escapedOrig,
          runtimeUnionArity,
          candidateMemberNs,
          candidateMembers,
          memberN,
          finalContext
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
        const [thenStmts, thenCtxAfter] = emitStatementAst(stmt.thenStatement, {
          ...withComplementNarrowing(
            originalName,
            escapedOrig,
            runtimeUnionArity,
            candidateMemberNs,
            candidateMembers,
            memberN,
            ctxWithId
          ),
        });
        thenStmt = wrapInBlock(thenStmts);
        thenCtx = thenCtxAfter;
      } else {
        const [thenStmts, thenCtxAfter] = emitStatementAst(
          stmt.thenStatement,
          ctxWithId
        );
        thenStmt = wrapInBlock(thenStmts);
        thenCtx = thenCtxAfter;
      }

      finalContext = thenCtx;

      let elseStmt: CSharpStatementAst | undefined;
      if (stmt.elseStatement) {
        const castStmt = buildCastLocalDecl(
          escapedNarrow,
          escapedOrig,
          memberN
        );
        const [elseBlock, elseBodyCtx] = emitForcedBlockWithPreambleAst(
          [castStmt],
          stmt.elseStatement,
          { ...ctxWithId, narrowedBindings: narrowedMap }
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
          buildExprBinding(
            buildUnionNarrowAst(escapedOrig, memberN),
            candidateMembers[
              candidateMemberNs.findIndex(
                (runtimeMemberN) => runtimeMemberN === memberN
              )
            ],
            undefined,
            toReceiverAst(escapedOrig)
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
  }

  // Case A2: if (x instanceof Foo) { ... }
  // C# pattern var narrowing → if (x is Foo x__is_k) { ... }
  const instanceofGuard = tryResolveInstanceofGuard(stmt.condition, context);
  if (instanceofGuard) {
    const {
      ctxAfterRhs,
      escapedOrig,
      escapedNarrow,
      rhsTypeAst,
      narrowedMap,
      memberN,
      runtimeUnionArity,
      candidateMemberNs,
      candidateMembers,
      receiverAst,
    } = instanceofGuard;

    const condAst =
      memberN && runtimeUnionArity && candidateMemberNs && candidateMembers
        ? buildIsNCondition(receiverAst, memberN, false)
        : buildIsPatternCondition(receiverAst, rhsTypeAst, escapedNarrow);

    let thenStatementAst: CSharpStatementAst;
    let thenCtxAfter: EmitterContext;
    if (memberN && runtimeUnionArity && candidateMemberNs && candidateMembers) {
      const [thenBlock, thenBlockCtx] = emitForcedBlockWithPreambleAst(
        [buildCastLocalDecl(escapedNarrow, receiverAst, memberN, rhsTypeAst)],
        stmt.thenStatement,
        {
          ...ctxAfterRhs,
          narrowedBindings: narrowedMap,
        }
      );
      thenStatementAst = thenBlock;
      thenCtxAfter = thenBlockCtx;
    } else {
      const [thenStmts, nextCtx] = emitStatementAst(stmt.thenStatement, {
        ...ctxAfterRhs,
        narrowedBindings: narrowedMap,
      });
      thenStatementAst = wrapInBlock(thenStmts);
      thenCtxAfter = nextCtx;
    }

    let finalContext: EmitterContext = {
      ...thenCtxAfter,
      narrowedBindings: ctxAfterRhs.narrowedBindings,
    };

    let elseStmt: CSharpStatementAst | undefined;
    if (stmt.elseStatement) {
      const [elseStmts, elseCtx] = emitStatementAst(
        stmt.elseStatement,
        finalContext
      );
      elseStmt = wrapInBlock(elseStmts);
      finalContext = elseCtx;
    }

    if (!stmt.elseStatement && isDefinitelyTerminating(stmt.thenStatement)) {
      const fallthroughBaseContext: EmitterContext = {
        ...finalContext,
        narrowedBindings: ctxAfterRhs.narrowedBindings,
      };
      const instanceofSourceType =
        stmt.condition.kind === "binary"
          ? stmt.condition.left.inferredType
          : undefined;
      const fallthroughSourceType =
        fallthroughBaseContext.narrowedBindings?.get(
          instanceofGuard.originalName
        )?.sourceType ??
        fallthroughBaseContext.narrowedBindings?.get(
          instanceofGuard.originalName
        )?.type ??
        instanceofSourceType;
      const fallthroughRuntimeFrame =
        fallthroughSourceType &&
        resolveRuntimeUnionFrame(
          instanceofGuard.originalName,
          fallthroughSourceType,
          fallthroughBaseContext
        );
      if (
        memberN !== undefined &&
        fallthroughRuntimeFrame &&
        fallthroughRuntimeFrame.candidateMemberNs.includes(memberN)
      ) {
        finalContext = withComplementNarrowing(
          instanceofGuard.originalName,
          receiverAst,
          fallthroughRuntimeFrame.runtimeUnionArity,
          fallthroughRuntimeFrame.candidateMemberNs,
          fallthroughRuntimeFrame.members,
          memberN,
          fallthroughBaseContext
        );
      } else {
        const fallthroughContext = applyConditionBranchNarrowing(
          stmt.condition,
          "falsy",
          fallthroughBaseContext,
          emitExprAstCb
        );
        if (fallthroughContext) {
          finalContext = fallthroughContext;
        } else {
          const complementType = narrowTypeByNotAssignableTarget(
            stmt.condition.kind === "binary"
              ? stmt.condition.left.inferredType
              : undefined,
            instanceofGuard.targetType,
            ctxAfterRhs
          );
          if (complementType) {
            finalContext = applyExprFallthroughNarrowing(
              instanceofGuard.originalName,
              { kind: "identifierExpression", identifier: escapedOrig },
              complementType,
              ctxAfterRhs,
              finalContext
            );
          }
        }
      }
    }

    return [
      [
        {
          kind: "ifStatement",
          condition: condAst,
          thenStatement: thenStatementAst,
          elseStatement: elseStmt,
        },
      ],
      finalContext,
    ];
  }

  const arrayIsArrayGuard = tryExtractArrayIsArrayGuard(stmt.condition);
  if (arrayIsArrayGuard) {
    const [rawTargetAst, condCtxAfterCond] = emitExpressionAst(
      arrayIsArrayGuard.targetExpr,
      context
    );
    const runtimeUnionFrame =
      arrayIsArrayGuard.targetExpr.inferredType &&
      resolveRuntimeUnionFrame(
        arrayIsArrayGuard.originalName,
        arrayIsArrayGuard.targetExpr.inferredType,
        condCtxAfterCond
      );
    const runtimeArrayPairs =
      runtimeUnionFrame?.members.flatMap((member, index) => {
        if (
          !member ||
          !isArrayLikeNarrowingCandidate(member, condCtxAfterCond)
        ) {
          return [];
        }
        const runtimeMemberN = runtimeUnionFrame.candidateMemberNs[index];
        if (!runtimeMemberN) {
          return [];
        }
        return [{ memberType: member, runtimeMemberN }];
      }) ?? [];
    const narrowedType = narrowTypeByArrayShape(
      arrayIsArrayGuard.targetExpr.inferredType,
      arrayIsArrayGuard.narrowsInThen,
      condCtxAfterCond
    );

    if (narrowedType) {
      const runtimeArrayPair =
        runtimeArrayPairs.length === 1 ? runtimeArrayPairs[0] : undefined;

      if (
        runtimeUnionFrame &&
        runtimeArrayPair &&
        runtimeUnionFrame.runtimeUnionArity >= 2
      ) {
        const [, condCtxAfterCondAst] = emitBooleanConditionAst(
          stmt.condition,
          emitExprAstCb,
          condCtxAfterCond
        );

        const arrayBranchContext = withRuntimeUnionMemberNarrowing(
          arrayIsArrayGuard.originalName,
          rawTargetAst,
          runtimeArrayPair.runtimeMemberN,
          runtimeArrayPair.memberType,
          arrayIsArrayGuard.targetExpr.inferredType,
          condCtxAfterCondAst
        );
        const nonArrayBranchContext = withComplementNarrowing(
          arrayIsArrayGuard.originalName,
          rawTargetAst,
          runtimeUnionFrame.runtimeUnionArity,
          runtimeUnionFrame.candidateMemberNs,
          runtimeUnionFrame.members,
          runtimeArrayPair.runtimeMemberN,
          condCtxAfterCondAst
        );

        const thenCtx =
          arrayIsArrayGuard.narrowsInThen &&
          runtimeUnionFrame.runtimeUnionArity >= 2
            ? arrayBranchContext
            : nonArrayBranchContext;
        const [thenStmts, thenCtxAfter] = emitStatementAst(
          stmt.thenStatement,
          thenCtx
        );
        const thenStatementAst = wrapInBlock(thenStmts);

        let finalContext: EmitterContext = {
          ...thenCtxAfter,
          narrowedBindings: condCtxAfterCond.narrowedBindings,
        };

        let elseStmt: CSharpStatementAst | undefined;
        if (stmt.elseStatement) {
          const elseCtx = arrayIsArrayGuard.narrowsInThen
            ? nonArrayBranchContext
            : arrayBranchContext;
          const [elseStmts, elseCtxAfter] = emitStatementAst(
            stmt.elseStatement,
            elseCtx
          );
          elseStmt = wrapInBlock(elseStmts);
          finalContext = {
            ...elseCtxAfter,
            narrowedBindings: condCtxAfterCond.narrowedBindings,
          };
        }

        if (
          !stmt.elseStatement &&
          isDefinitelyTerminating(stmt.thenStatement)
        ) {
          finalContext = arrayIsArrayGuard.narrowsInThen
            ? nonArrayBranchContext
            : arrayBranchContext;
        }

        const runtimeCondAst = buildIsNCondition(
          rawTargetAst,
          runtimeArrayPair.runtimeMemberN,
          !arrayIsArrayGuard.narrowsInThen
        );

        return [
          [
            {
              kind: "ifStatement",
              condition: runtimeCondAst,
              thenStatement: thenStatementAst,
              elseStatement: elseStmt,
            },
          ],
          finalContext,
        ];
      }

      const narrowedMap = new Map(condCtxAfterCond.narrowedBindings ?? []);
      const [narrowedTypeAst, narrowedTypeCtx] = emitTypeAst(
        narrowedType,
        condCtxAfterCond
      );
      narrowedMap.set(
        arrayIsArrayGuard.originalName,
        buildExprBinding(
          {
            kind: "castExpression",
            type: narrowedTypeAst,
            expression: rawTargetAst,
          },
          narrowedType,
          undefined,
          rawTargetAst
        )
      );

      const [condAst, condCtxAfterCondAst] = emitBooleanConditionAst(
        stmt.condition,
        emitExprAstCb,
        condCtxAfterCond
      );

      const thenCtx: EmitterContext = {
        ...narrowedTypeCtx,
        ...condCtxAfterCondAst,
        narrowedBindings: arrayIsArrayGuard.narrowsInThen
          ? narrowedMap
          : condCtxAfterCond.narrowedBindings,
      };
      const [thenStmts, thenCtxAfter] = emitStatementAst(
        stmt.thenStatement,
        thenCtx
      );
      const thenStatementAst = wrapInBlock(thenStmts);

      let finalContext: EmitterContext = {
        ...thenCtxAfter,
        narrowedBindings: condCtxAfterCond.narrowedBindings,
      };

      let elseStmt: CSharpStatementAst | undefined;
      if (stmt.elseStatement) {
        const elseCtx: EmitterContext = {
          ...finalContext,
          narrowedBindings: arrayIsArrayGuard.narrowsInThen
            ? condCtxAfterCond.narrowedBindings
            : narrowedMap,
        };
        const [elseStmts, elseCtxAfter] = emitStatementAst(
          stmt.elseStatement,
          elseCtx
        );
        elseStmt = wrapInBlock(elseStmts);
        finalContext = {
          ...elseCtxAfter,
          narrowedBindings: condCtxAfterCond.narrowedBindings,
        };
      }

      if (!stmt.elseStatement && isDefinitelyTerminating(stmt.thenStatement)) {
        const complementType = narrowTypeByArrayShape(
          arrayIsArrayGuard.targetExpr.inferredType,
          !arrayIsArrayGuard.narrowsInThen,
          condCtxAfterCond
        );
        if (complementType) {
          finalContext = applyExprFallthroughNarrowing(
            arrayIsArrayGuard.originalName,
            rawTargetAst,
            complementType,
            condCtxAfterCond,
            finalContext
          );
        }
      }

      return [
        [
          {
            kind: "ifStatement",
            condition: condAst,
            thenStatement: thenStatementAst,
            elseStatement: elseStmt,
          },
        ],
        finalContext,
      ];
    }
  }

  // Case B: if (!isUser(account)) { ... } else { ... }
  // Negated guard → for 2-member unions, narrow THEN to OTHER member, ELSE to guard's target
  if (
    stmt.condition.kind === "unary" &&
    stmt.condition.operator === "!" &&
    stmt.condition.expression.kind === "call" &&
    stmt.elseStatement
  ) {
    const innerCall = stmt.condition.expression;
    const guard = tryResolvePredicateGuard(innerCall, context);
    if (guard) {
      const {
        originalName,
        receiverAst,
        memberN,
        unionArity,
        candidateMemberNs,
        candidateMembers,
        ctxWithId,
        escapedNarrow,
        narrowedMap,
      } = guard;

      const condAst = buildIsNCondition(receiverAst, memberN, true);

      // THEN branch: for 2-member unions narrow to OTHER member
      let thenStmt: CSharpStatementAst;
      let thenCtx: EmitterContext;

      if (unionArity === 2) {
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
        const nextId = (ctxWithId.tempVarId ?? 0) + 1;
        const thenCtxWithId: EmitterContext = {
          ...ctxWithId,
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
        });

        const thenCastStmt = buildCastLocalDecl(
          escapedThenNarrow,
          receiverAst,
          otherMemberN
        );

        const [thenBlock, thenBlockCtx] = emitForcedBlockWithPreambleAst(
          [thenCastStmt],
          stmt.thenStatement,
          { ...thenCtxWithId, narrowedBindings: thenNarrowedMap }
        );
        thenStmt = thenBlock;
        thenCtx = thenBlockCtx;
      } else {
        const [thenStmts, thenCtxAfter] = emitStatementAst(
          stmt.thenStatement,
          context
        );
        thenStmt = wrapInBlock(thenStmts);
        thenCtx = thenCtxAfter;
      }

      // ELSE branch: narrowing applies (to guard's target type)
      const elseCastStmt = buildCastLocalDecl(
        escapedNarrow,
        receiverAst,
        memberN
      );
      const [elseBlock, _elseBodyCtx] = emitForcedBlockWithPreambleAst(
        [elseCastStmt],
        stmt.elseStatement,
        { ...ctxWithId, narrowedBindings: narrowedMap }
      );

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
  }

  // Case B2: if (!(x instanceof Foo)) { ... } else { ... }
  // Swap branches so ELSE runs under the narrowed pattern var.
  if (
    stmt.condition.kind === "unary" &&
    stmt.condition.operator === "!" &&
    stmt.elseStatement
  ) {
    const inner = stmt.condition.expression;
    const guard = tryResolveInstanceofGuard(inner, context);
    if (guard) {
      const {
        ctxAfterRhs,
        escapedNarrow,
        rhsTypeAst,
        narrowedMap,
        memberN,
        receiverAst,
      } = guard;

      const condAst =
        memberN !== undefined
          ? buildIsNCondition(receiverAst, memberN, false)
          : buildIsPatternCondition(receiverAst, rhsTypeAst, escapedNarrow);

      let thenStatementAst: CSharpStatementAst;
      let thenCtxAfter: EmitterContext;
      if (memberN !== undefined) {
        const [thenBlock, thenBlockCtx] = emitForcedBlockWithPreambleAst(
          [buildCastLocalDecl(escapedNarrow, receiverAst, memberN, rhsTypeAst)],
          stmt.elseStatement,
          {
            ...ctxAfterRhs,
            narrowedBindings: narrowedMap,
          }
        );
        thenStatementAst = thenBlock;
        thenCtxAfter = thenBlockCtx;
      } else {
        const [thenStmts, nextCtx] = emitStatementAst(stmt.elseStatement, {
          ...ctxAfterRhs,
          narrowedBindings: narrowedMap,
        });
        thenStatementAst = wrapInBlock(thenStmts);
        thenCtxAfter = nextCtx;
      }

      // ELSE branch is the original THEN (not narrowed)
      const [elseStmts, elseCtxAfter] = emitStatementAst(stmt.thenStatement, {
        ...thenCtxAfter,
        narrowedBindings: ctxAfterRhs.narrowedBindings,
      });

      return [
        [
          {
            kind: "ifStatement",
            condition: condAst,
            thenStatement: thenStatementAst,
            elseStatement: wrapInBlock(elseStmts),
          },
        ],
        elseCtxAfter,
      ];
    }
  }

  // Case C: if (isUser(account) && account.foo) { ... }
  // Logical AND with predicate guard on left → nested-if lowering
  if (stmt.condition.kind === "logical" && stmt.condition.operator === "&&") {
    const left = stmt.condition.left;
    const right = stmt.condition.right;

    if (left.kind === "call") {
      const guard = tryResolvePredicateGuard(left, context);
      if (guard) {
        const { memberN, ctxWithId, receiverAst, escapedNarrow, narrowedMap } =
          guard;

        const outerCondAst = buildIsNCondition(receiverAst, memberN, false);
        const castStmt = buildCastLocalDecl(
          escapedNarrow,
          receiverAst,
          memberN
        );

        // Emit RHS condition under narrowed context
        const outerThenCtx: EmitterContext = {
          ...ctxWithId,
          narrowedBindings: narrowedMap,
        };

        const [rhsAst, rhsCtxAfterEmit] = emitExpressionAst(
          right,
          outerThenCtx
        );
        const [rhsCondAst, rhsCtxAfterCond] = toBooleanConditionAst(
          right,
          rhsAst,
          rhsCtxAfterEmit
        );

        // When RHS true: emit original THEN under narrowed context
        const [thenStmts, thenCtxAfter] = emitStatementAst(
          stmt.thenStatement,
          rhsCtxAfterCond
        );

        const clearNarrowing = (ctx: EmitterContext): EmitterContext => ({
          ...ctx,
          narrowedBindings: ctxWithId.narrowedBindings,
        });

        // Build inner if
        let innerElse: CSharpStatementAst | undefined;
        let currentCtx = thenCtxAfter;
        if (stmt.elseStatement) {
          const [innerElseStmts, innerElseCtx] = emitStatementAst(
            stmt.elseStatement,
            clearNarrowing(currentCtx)
          );
          innerElse = wrapInBlock(innerElseStmts);
          currentCtx = innerElseCtx;
        }

        const innerIf: CSharpStatementAst = {
          kind: "ifStatement",
          condition: rhsCondAst,
          thenStatement: wrapInBlock(thenStmts),
          elseStatement: innerElse,
        };

        // Build outer then block: { cast; innerIf }
        const outerThenBlock: CSharpBlockStatementAst = {
          kind: "blockStatement",
          statements: [castStmt, innerIf],
        };

        // Outer else: emit ELSE as-is (no narrowing)
        let outerElse: CSharpStatementAst | undefined;
        let finalContext = clearNarrowing(currentCtx);
        if (stmt.elseStatement) {
          const [outerElseStmts, outerElseCtx] = emitStatementAst(
            stmt.elseStatement,
            finalContext
          );
          outerElse = wrapInBlock(outerElseStmts);
          finalContext = outerElseCtx;
        }

        return [
          [
            {
              kind: "ifStatement",
              condition: outerCondAst,
              thenStatement: outerThenBlock,
              elseStatement: outerElse,
            },
          ],
          finalContext,
        ];
      }
    }

    // Case C2: if (x instanceof Foo && x.foo) { ... }
    if (left.kind === "binary" && left.operator === "instanceof") {
      const guard = tryResolveInstanceofGuard(left, context);
      if (guard) {
        const {
          ctxAfterRhs,
          receiverAst,
          escapedNarrow,
          rhsTypeAst,
          narrowedMap,
        } = guard;

        const rhsCtx: EmitterContext = {
          ...ctxAfterRhs,
          narrowedBindings: narrowedMap,
        };

        const [rhsAst, rhsCtxAfterEmit] = emitExpressionAst(right, rhsCtx);
        const [rhsCondAst, rhsCtxAfterCond] = toBooleanConditionAst(
          right,
          rhsAst,
          rhsCtxAfterEmit
        );

        // Combined condition: (orig is TypeName narrow && rhsCond)
        const isPatternAst = buildIsPatternCondition(
          receiverAst,
          rhsTypeAst,
          escapedNarrow
        );
        const combinedCondAst: CSharpExpressionAst = {
          kind: "parenthesizedExpression",
          expression: {
            kind: "binaryExpression",
            operatorToken: "&&",
            left: isPatternAst,
            right: rhsCondAst,
          },
        };

        const thenCtx: EmitterContext = {
          ...rhsCtxAfterCond,
          narrowedBindings: narrowedMap,
        };
        const [thenStmts, thenCtxAfter] = emitStatementAst(
          stmt.thenStatement,
          thenCtx
        );

        let finalContext: EmitterContext = {
          ...thenCtxAfter,
          narrowedBindings: ctxAfterRhs.narrowedBindings,
        };

        let elseStmt: CSharpStatementAst | undefined;
        if (stmt.elseStatement) {
          const [elseStmts, elseCtx] = emitStatementAst(
            stmt.elseStatement,
            finalContext
          );
          elseStmt = wrapInBlock(elseStmts);
          finalContext = elseCtx;
        }

        return [
          [
            {
              kind: "ifStatement",
              condition: combinedCondAst,
              thenStatement: wrapInBlock(thenStmts),
              elseStatement: elseStmt,
            },
          ],
          finalContext,
        ];
      }
    }
  }

  // Case D: Nullable value type narrowing
  // if (id !== null) { ... } → id becomes id.Value in then-branch
  const simpleNullableGuard = tryResolveSimpleNullableGuard(stmt.condition);
  const nullableGuard =
    simpleNullableGuard ?? tryResolveNullableGuard(stmt.condition, context);
  if (nullableGuard && nullableGuard.isValueType) {
    const { key, targetExpr, narrowsInThen, strippedType } = nullableGuard;

    // Avoid stacking `.Value` (see detailed comment in original text emitter)
    const [idAst] =
      targetExpr.kind === "identifier"
        ? emitIdentifier(targetExpr, {
            ...context,
            narrowedBindings: undefined,
          })
        : emitExpressionAst(targetExpr, {
            ...context,
            narrowedBindings: undefined,
          });

    // Create narrowed binding: id → id.Value
    const narrowedMap = new Map(context.narrowedBindings ?? []);
    narrowedMap.set(
      key,
      buildExprBinding(
        {
          kind: "memberAccessExpression",
          expression: idAst,
          memberName: "Value",
        },
        strippedType,
        undefined,
        idAst
      )
    );

    // Soundness: In compound conditions (A && B), we must NOT apply "else" narrowing.
    const isAndCondition =
      stmt.condition.kind === "logical" && stmt.condition.operator === "&&";
    if (isAndCondition && !simpleNullableGuard && !narrowsInThen) {
      // `id == null` inside `&&` - skip nullable rewrite, fall through to standard.
    } else {
      // Emit condition
      const [condAst, condCtxAfterCond] = emitBooleanConditionAst(
        stmt.condition,
        emitExprAstCb,
        context
      );

      // Apply narrowing to appropriate branch
      const thenCtx: EmitterContext = {
        ...condCtxAfterCond,
        narrowedBindings: narrowsInThen
          ? narrowedMap
          : condCtxAfterCond.narrowedBindings,
      };

      const [thenStmts, thenCtxAfter] = emitStatementAst(
        stmt.thenStatement,
        thenCtx
      );

      let finalContext: EmitterContext = {
        ...thenCtxAfter,
        narrowedBindings: context.narrowedBindings,
      };

      let elseStmt: CSharpStatementAst | undefined;
      if (stmt.elseStatement) {
        const elseCtx: EmitterContext = {
          ...finalContext,
          narrowedBindings: !narrowsInThen
            ? simpleNullableGuard
              ? narrowedMap
              : context.narrowedBindings
            : context.narrowedBindings,
        };
        const [elseStmts, elseCtxAfter] = emitStatementAst(
          stmt.elseStatement,
          elseCtx
        );
        elseStmt = wrapInBlock(elseStmts);
        finalContext = {
          ...elseCtxAfter,
          narrowedBindings: context.narrowedBindings,
        };
      }

      return [
        [
          {
            kind: "ifStatement",
            condition: condAst,
            thenStatement: wrapInBlock(thenStmts),
            elseStatement: elseStmt,
          },
        ],
        finalContext,
      ];
    }
  }

  // Case E: typeof narrowing on plain locals/parameters, including
  // compound `&&` truthy branches and `||` fallthrough/else branches.
  const truthyTypeofRefinements = collectTypeofGuardRefinements(
    stmt.condition,
    "truthy"
  );
  const falsyTypeofRefinements = collectTypeofGuardRefinements(
    stmt.condition,
    "falsy"
  );
  if (truthyTypeofRefinements.length > 0 || falsyTypeofRefinements.length > 0) {
    const [condAst, condCtxAfterCond] = emitBooleanConditionAst(
      stmt.condition,
      emitExprAstCb,
      context
    );

    const thenCtx =
      truthyTypeofRefinements.length > 0
        ? applyTypeofGuardRefinements(condCtxAfterCond, truthyTypeofRefinements)
        : condCtxAfterCond;
    const [thenStmts, thenCtxAfter] = emitStatementAst(
      stmt.thenStatement,
      thenCtx
    );

    let finalContext: EmitterContext = {
      ...thenCtxAfter,
      narrowedBindings: condCtxAfterCond.narrowedBindings,
    };

    let elseStmt: CSharpStatementAst | undefined;
    if (stmt.elseStatement) {
      const elseBaseContext: EmitterContext = {
        ...finalContext,
        narrowedBindings: condCtxAfterCond.narrowedBindings,
      };
      const elseCtx =
        falsyTypeofRefinements.length > 0
          ? applyTypeofGuardRefinements(elseBaseContext, falsyTypeofRefinements)
          : elseBaseContext;
      const [elseStmts, elseCtxAfter] = emitStatementAst(
        stmt.elseStatement,
        elseCtx
      );
      elseStmt = wrapInBlock(elseStmts);
      finalContext = {
        ...elseCtxAfter,
        narrowedBindings: condCtxAfterCond.narrowedBindings,
      };
    }

    if (
      !stmt.elseStatement &&
      isDefinitelyTerminating(stmt.thenStatement) &&
      falsyTypeofRefinements.length > 0
    ) {
      finalContext = applyTypeofGuardRefinements(
        {
          ...finalContext,
          narrowedBindings: condCtxAfterCond.narrowedBindings,
        },
        falsyTypeofRefinements
      );
    }

    return [
      [
        {
          kind: "ifStatement",
          condition: condAst,
          thenStatement: wrapInBlock(thenStmts),
          elseStatement: elseStmt,
        },
      ],
      finalContext,
    ];
  }

  // Standard if-statement emission (no narrowing)
  const [condAst, condCtxAfterCond] = emitBooleanConditionAst(
    stmt.condition,
    emitExprAstCb,
    context
  );

  const thenCtx = applyConditionBranchNarrowing(
    stmt.condition,
    "truthy",
    condCtxAfterCond,
    emitExprAstCb
  );
  const [thenStmts, thenContext] = emitStatementAst(
    stmt.thenStatement,
    thenCtx
  );
  const thenTerminates = isDefinitelyTerminating(stmt.thenStatement);
  const basePostConditionContext = resetBranchFlowState(
    condCtxAfterCond,
    thenContext
  );
  let finalContext: EmitterContext = thenTerminates
    ? applyConditionBranchNarrowing(
        stmt.condition,
        "falsy",
        basePostConditionContext,
        emitExprAstCb
      )
    : basePostConditionContext;

  let elseStmt: CSharpStatementAst | undefined;
  if (stmt.elseStatement) {
    const elseEntryContext = applyConditionBranchNarrowing(
      stmt.condition,
      "falsy",
      {
        ...basePostConditionContext,
        narrowedBindings: condCtxAfterCond.narrowedBindings,
      },
      emitExprAstCb
    );
    const [elseStmts, elseContext] = emitStatementAst(
      stmt.elseStatement,
      elseEntryContext
    );
    elseStmt = wrapInBlock(elseStmts);
    const elseTerminates = isDefinitelyTerminating(stmt.elseStatement);

    if (thenTerminates && !elseTerminates) {
      finalContext = mergeBranchContextMeta(elseContext, thenContext);
    } else if (!thenTerminates && elseTerminates) {
      finalContext = mergeBranchContextMeta(thenContext, elseContext);
    } else {
      finalContext = mergeBranchContextMeta(
        resetBranchFlowState(condCtxAfterCond, elseContext),
        thenContext
      );
    }
  }

  return [
    [
      {
        kind: "ifStatement",
        condition: condAst,
        thenStatement: wrapInBlock(thenStmts),
        elseStatement: elseStmt,
      },
    ],
    finalContext,
  ];
};
