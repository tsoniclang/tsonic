import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { emitTypeAst } from "../../type-emitter.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";
import { identifierExpression } from "../../core/format/backend-ast/builders.js";
import { matchesExpectedEmissionType } from "../../core/semantic/expected-type-matching.js";
import {
  buildExpectedRuntimeCarrierTarget,
  tryBuildRuntimeMaterializationAst,
} from "../../core/semantic/runtime-reification.js";
import type { RuntimeMaterializationSourceFrame } from "../../core/semantic/runtime-reification.js";
import {
  buildRuntimeUnionLayout,
  buildRuntimeUnionTypeAst,
} from "../../core/semantic/runtime-unions.js";
import {
  buildInvalidRuntimeUnionMaterializationExpression,
  buildRuntimeUnionFactoryCallAst,
  tryBuildRuntimeUnionProjectionToLayoutAst,
} from "../../core/semantic/runtime-union-projection.js";
import { runtimeUnionAliasReferencesMatch } from "../../core/semantic/runtime-union-alias-identity.js";
import { willCarryAsRuntimeUnion } from "../../core/semantic/union-semantics.js";
import { resolveDirectRuntimeCarrierType } from "../../core/semantic/direct-value-surfaces.js";
import { areIrTypesEquivalent } from "../../core/semantic/type-equivalence.js";

type TargetMemberCandidate = {
  readonly index: number;
  readonly member: IrType;
};

const findExpectedTargetMemberCandidate = (
  member: IrType,
  index: number,
  narrowedType: IrType,
  context: EmitterContext
): TargetMemberCandidate | undefined => {
  if (runtimeUnionAliasReferencesMatch(member, narrowedType, context)) {
    return { index, member };
  }

  if (matchesExpectedEmissionType(narrowedType, member, context)) {
    return { index, member };
  }

  const nestedMaterialization = tryBuildRuntimeMaterializationAst(
    identifierExpression("__tsonic_expected_member_probe"),
    narrowedType,
    member,
    context,
    emitTypeAst
  );
  return nestedMaterialization ? { index, member } : undefined;
};

export const tryMaterializeRuntimeUnionNarrowingForExpectedTarget = (opts: {
  readonly sourceCarrierAst: CSharpExpressionAst;
  readonly sourceType: IrType;
  readonly narrowedType: IrType;
  readonly expectedType: IrType;
  readonly context: EmitterContext;
  readonly selectedSourceMemberNs?: ReadonlySet<number>;
  readonly sourceFrame?: RuntimeMaterializationSourceFrame;
}): [CSharpExpressionAst, EmitterContext] | undefined => {
  const {
    sourceCarrierAst,
    sourceType,
    narrowedType,
    expectedType,
    context,
    selectedSourceMemberNs,
    sourceFrame,
  } = opts;

  if (runtimeUnionAliasReferencesMatch(narrowedType, expectedType, context)) {
    const directSourceCarrierType = sourceFrame
      ? undefined
      : resolveDirectRuntimeCarrierType(sourceCarrierAst, context);
    const effectiveSourceType = directSourceCarrierType ?? sourceType;
    const effectiveSourceFrame: RuntimeMaterializationSourceFrame | undefined =
      sourceFrame ??
      (effectiveSourceType.kind === "unionType"
        ? {
            members: effectiveSourceType.types,
            candidateMemberNs: effectiveSourceType.types.map(
              (_member, index) => index + 1
            ),
            runtimeUnionArity: effectiveSourceType.types.length,
          }
        : undefined);
    const effectiveExpectedTarget = buildExpectedRuntimeCarrierTarget(
      expectedType,
      context,
      emitTypeAst
    );
    if (!sourceFrame && effectiveSourceType.kind === "unionType") {
      const [sourceLayout, sourceLayoutContext] = buildRuntimeUnionLayout(
        effectiveSourceType,
        context,
        emitTypeAst
      );
      const [targetLayout, targetLayoutContext] = buildRuntimeUnionLayout(
        effectiveExpectedTarget,
        sourceLayoutContext,
        emitTypeAst
      );
      if (sourceLayout && targetLayout) {
        const projected = tryBuildRuntimeUnionProjectionToLayoutAst({
          valueAst: sourceCarrierAst,
          sourceLayout,
          targetLayout,
          context: targetLayoutContext,
          candidateMemberNs: effectiveSourceFrame?.candidateMemberNs,
          selectedSourceMemberNs,
          buildMappedMemberValue: ({
            actualMember,
            parameterExpr,
            targetMember,
            context: memberContext,
          }) =>
            tryBuildRuntimeMaterializationAst(
              parameterExpr,
              actualMember,
              targetMember,
              memberContext,
              emitTypeAst
            ),
          buildExcludedMemberBody: ({ actualMember }) =>
            buildInvalidRuntimeUnionMaterializationExpression(
              actualMember,
              effectiveExpectedTarget
            ),
          buildUnmappedMemberBody: ({ actualMember }) =>
            buildInvalidRuntimeUnionMaterializationExpression(
              actualMember,
              effectiveExpectedTarget
            ),
        });
        if (projected) {
          return projected;
        }
      }
    }
    const materialized = tryBuildRuntimeMaterializationAst(
      sourceCarrierAst,
      effectiveSourceType,
      effectiveExpectedTarget,
      context,
      emitTypeAst,
      selectedSourceMemberNs,
      effectiveSourceFrame
    );
    return materialized;
  }

  if (
    areIrTypesEquivalent(narrowedType, expectedType, context) ||
    !willCarryAsRuntimeUnion(narrowedType, context) ||
    !willCarryAsRuntimeUnion(expectedType, context)
  ) {
    return undefined;
  }

  const [expectedLayout, expectedLayoutContext] = buildRuntimeUnionLayout(
    buildExpectedRuntimeCarrierTarget(expectedType, context, emitTypeAst),
    context,
    emitTypeAst
  );
  if (!expectedLayout) {
    return undefined;
  }

  const candidates = expectedLayout.members.flatMap((member, index) => {
    if (!member) {
      return [];
    }

    const candidate = findExpectedTargetMemberCandidate(
      member,
      index,
      narrowedType,
      expectedLayoutContext
    );
    return candidate ? [candidate] : [];
  });
  if (candidates.length !== 1) {
    return undefined;
  }

  const [candidate] = candidates;
  if (!candidate) {
    return undefined;
  }

  const materializedMember = tryBuildRuntimeMaterializationAst(
    sourceCarrierAst,
    sourceType,
    candidate.member,
    expectedLayoutContext,
    emitTypeAst,
    selectedSourceMemberNs,
    sourceFrame
  );
  if (!materializedMember) {
    return undefined;
  }

  return [
    buildRuntimeUnionFactoryCallAst(
      buildRuntimeUnionTypeAst(expectedLayout),
      candidate.index + 1,
      materializedMember[0]
    ),
    materializedMember[1],
  ];
};
