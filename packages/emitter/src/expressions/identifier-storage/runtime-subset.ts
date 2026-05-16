import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, NarrowedBinding } from "../../types.js";
import { emitTypeAst } from "../../type-emitter.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import { identifierExpression } from "../../core/format/backend-ast/builders.js";
import { stableTypeKeyFromAst } from "../../core/format/backend-ast/utils.js";
import {
  RuntimeMaterializationSourceFrame,
  tryBuildRuntimeMaterializationAst,
} from "../../core/semantic/runtime-reification.js";
import { buildRuntimeUnionLayout } from "../../core/semantic/runtime-unions.js";
import { getCanonicalRuntimeUnionMembers } from "../../core/semantic/runtime-union-frame.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";
import { willCarryAsRuntimeUnion } from "../../core/semantic/union-semantics.js";
import { isBroadStorageTarget } from "./broad-storage-target.js";
import { wrapMaterializedTargetAst } from "./storage-surface-shared.js";

export const buildRuntimeSubsetExpressionAst = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  narrowed: Extract<NarrowedBinding, { kind: "runtimeSubset" }>,
  context: EmitterContext,
  targetType: IrType | undefined = narrowed.type
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const sourceType = narrowed.sourceType ?? expr.inferredType;
  if (!sourceType || !targetType) {
    return undefined;
  }

  const sourceFrame: RuntimeMaterializationSourceFrame | undefined = (() => {
    const sourceValueAst =
      narrowed.storageExprAst ??
      identifierExpression(escapeCSharpIdentifier(expr.name));
    if (
      narrowed.sourceMembers &&
      narrowed.sourceCandidateMemberNs &&
      narrowed.sourceMembers.length === narrowed.sourceCandidateMemberNs.length
    ) {
      const explicitFrame = {
        members: narrowed.sourceMembers,
        candidateMemberNs: narrowed.sourceCandidateMemberNs,
        runtimeUnionArity: narrowed.runtimeUnionArity,
      };
      const storageType = context.localValueTypes?.get(expr.name);
      const storageMembers =
        sourceValueAst.kind === "identifierExpression" && storageType
          ? getCanonicalRuntimeUnionMembers(storageType, context)
          : undefined;
      return storageMembers &&
        storageMembers.length > (explicitFrame.runtimeUnionArity ?? 0)
        ? {
            members: storageMembers,
            candidateMemberNs: storageMembers.map((_, index) => index + 1),
            runtimeUnionArity: storageMembers.length,
          }
        : explicitFrame;
    }

    const inferredMembers = narrowed.type
      ? getCanonicalRuntimeUnionMembers(narrowed.type, context)
      : undefined;
    return inferredMembers &&
      inferredMembers.length === narrowed.runtimeMemberNs.length
      ? {
          members: inferredMembers,
          candidateMemberNs: narrowed.runtimeMemberNs,
          runtimeUnionArity: narrowed.runtimeUnionArity,
        }
      : undefined;
  })();
  const sourceValueAst =
    narrowed.storageExprAst ??
    identifierExpression(escapeCSharpIdentifier(expr.name));

  const materialized = tryBuildRuntimeMaterializationAst(
    sourceValueAst,
    sourceType,
    targetType,
    context,
    emitTypeAst,
    new Set(narrowed.runtimeMemberNs),
    sourceFrame
  );
  if (!materialized) {
    return undefined;
  }

  return wrapMaterializedTargetAst(
    materialized[0],
    targetType,
    materialized[1]
  );
};

export const tryEmitRuntimeSubsetMemberProjectionIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  narrowed: Extract<NarrowedBinding, { kind: "runtimeSubset" }>,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (
    !expectedType ||
    isBroadStorageTarget(expectedType, context) ||
    willCarryAsRuntimeUnion(expectedType, context) ||
    narrowed.runtimeMemberNs.length !== 1
  ) {
    return undefined;
  }

  const [sourceMemberN] = narrowed.runtimeMemberNs;
  if (sourceMemberN === undefined || sourceMemberN < 1) {
    return undefined;
  }

  const sourceType = narrowed.sourceType ?? expr.inferredType;
  if (!sourceType) {
    return undefined;
  }

  const [sourceLayout, sourceLayoutContext] = buildRuntimeUnionLayout(
    sourceType,
    context,
    emitTypeAst
  );
  const sourceMember = sourceLayout?.members[sourceMemberN - 1];
  if (!sourceLayout || !sourceMember) {
    return undefined;
  }

  const [sourceMemberAst, sourceMemberContext] = emitTypeAst(
    sourceMember,
    sourceLayoutContext
  );
  const [expectedAst, expectedContext] = emitTypeAst(
    expectedType,
    sourceMemberContext
  );
  if (
    stableTypeKeyFromAst(sourceMemberAst) !== stableTypeKeyFromAst(expectedAst)
  ) {
    return undefined;
  }

  const carrierAst =
    narrowed.storageExprAst ??
    identifierExpression(
      context.localNameMap?.get(expr.name) ?? escapeCSharpIdentifier(expr.name)
    );

  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: carrierAst,
        memberName: `As${sourceMemberN}`,
      },
      arguments: [],
    },
    expectedContext,
  ];
};
