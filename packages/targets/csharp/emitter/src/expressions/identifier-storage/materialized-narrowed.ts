import { IrType } from "@tsonic/frontend";
import { EmitterContext, NarrowedBinding } from "../../types.js";
import { emitTypeAst } from "../../type-emitter.js";
import {
  sameTypeAstSurface,
  stripNullableTypeAst,
} from "../../core/format/backend-ast/utils.js";
import { matchesExpectedEmissionType } from "../../core/semantic/expected-type-matching.js";
import { materializeDirectNarrowingAst } from "../../core/semantic/materialized-narrowing.js";
import { tryResolveRuntimeUnionMemberType } from "../../core/semantic/narrowed-expression-types.js";
import {
  buildRuntimeUnionLayout,
  buildRuntimeUnionTypeAst,
} from "../../core/semantic/runtime-unions.js";
import { buildRuntimeUnionFactoryCallAst } from "../../core/semantic/runtime-union-projection.js";
import { resolveDirectValueSurfaceType } from "../../core/semantic/direct-value-surfaces.js";
import { runtimeUnionAliasReferencesMatch } from "../../core/semantic/runtime-union-alias-identity.js";
import { willCarryAsRuntimeUnion } from "../../core/semantic/union-semantics.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";
import { wrapMaterializedTargetAst } from "./storage-surface-shared.js";
import { isRuntimeUnionProjectionAst } from "./runtime-projection-ast.js";
import { tryMaterializeRuntimeUnionNarrowingForExpectedTarget } from "./runtime-union-narrowing-target.js";
import {
  tryEmitSourceCarrierMemberProjection,
  tryMaterializeStorageRuntimeUnionMember,
} from "./materialized-narrowed-carrier.js";

export const tryEmitMaterializedNarrowedIdentifier = (
  narrowed: Extract<NarrowedBinding, { kind: "expr" }>,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!expectedType) {
    return undefined;
  }

  const storageExprAst = narrowed.storageExprAst;
  const storageSurfaceType = storageExprAst
    ? resolveDirectValueSurfaceType(narrowed.storageExprAst, context)
    : undefined;
  if (
    storageSurfaceType &&
    storageExprAst &&
    isRuntimeUnionProjectionAst(storageExprAst) &&
    !willCarryAsRuntimeUnion(expectedType, context) &&
    matchesExpectedEmissionType(storageSurfaceType, expectedType, context)
  ) {
    return [storageExprAst, context];
  }

  const effectiveType = narrowed.type ?? narrowed.sourceType;
  if (!effectiveType) {
    return undefined;
  }

  const sourceCarrierAst = narrowed.carrierExprAst ?? narrowed.storageExprAst;
  if (sourceCarrierAst && narrowed.sourceType && narrowed.type) {
    const materializedNarrowedCarrier =
      tryMaterializeRuntimeUnionNarrowingForExpectedTarget({
        sourceCarrierAst,
        sourceType: narrowed.sourceType,
        narrowedType: narrowed.type,
        expectedType,
        context,
      });
    if (materializedNarrowedCarrier) {
      return materializedNarrowedCarrier;
    }
  }

  if (sourceCarrierAst && narrowed.sourceType) {
    const sourceCarrierMemberProjection = tryEmitSourceCarrierMemberProjection({
      sourceCarrierAst,
      sourceType: narrowed.sourceType,
      effectiveType,
      expectedType,
      context,
    });
    if (sourceCarrierMemberProjection) {
      return sourceCarrierMemberProjection;
    }
  }

  if (
    sourceCarrierAst &&
    narrowed.sourceType &&
    !willCarryAsRuntimeUnion(expectedType, context) &&
    matchesExpectedEmissionType(effectiveType, expectedType, context)
  ) {
    const resolvedSourceType = narrowed.sourceType;
    if (
      resolvedSourceType.kind === "referenceType" &&
      resolvedSourceType.name === "object"
    ) {
      const [expectedTypeAst, expectedTypeContext] = emitTypeAst(
        expectedType,
        context
      );
      return [
        {
          kind: "castExpression",
          type: stripNullableTypeAst(expectedTypeAst),
          expression: sourceCarrierAst,
        },
        expectedTypeContext,
      ];
    }
  }

  if (narrowed.storageExprAst && narrowed.sourceType) {
    const storageMaterialized = tryMaterializeStorageRuntimeUnionMember({
      storageExprAst: narrowed.storageExprAst,
      sourceType: narrowed.sourceType,
      expectedType,
      context,
    });
    if (storageMaterialized) {
      return storageMaterialized;
    }
  }

  const directMemberType = tryResolveRuntimeUnionMemberType(
    narrowed.sourceType ?? effectiveType,
    narrowed.exprAst,
    context
  );
  if (
    directMemberType &&
    willCarryAsRuntimeUnion(directMemberType, context) &&
    willCarryAsRuntimeUnion(expectedType, context) &&
    runtimeUnionAliasReferencesMatch(directMemberType, expectedType, context)
  ) {
    return [narrowed.exprAst, context];
  }

  const directSurfaceMemberType =
    resolveDirectValueSurfaceType(narrowed.exprAst, context) ??
    directMemberType;

  const directAliasCarrierType = directMemberType ?? directSurfaceMemberType;
  if (
    directAliasCarrierType &&
    willCarryAsRuntimeUnion(directAliasCarrierType, context) &&
    willCarryAsRuntimeUnion(expectedType, context)
  ) {
    const [expectedLayout, expectedLayoutContext] = buildRuntimeUnionLayout(
      expectedType,
      context,
      emitTypeAst
    );
    if (expectedLayout) {
      const aliasMemberIndices = expectedLayout.members.flatMap(
        (member, index) =>
          member &&
          runtimeUnionAliasReferencesMatch(
            member,
            directAliasCarrierType,
            expectedLayoutContext
          )
            ? [index]
            : []
      );
      if (aliasMemberIndices.length === 1) {
        const [memberIndex] = aliasMemberIndices;
        if (memberIndex !== undefined) {
          return [
            buildRuntimeUnionFactoryCallAst(
              buildRuntimeUnionTypeAst(expectedLayout),
              memberIndex + 1,
              narrowed.exprAst
            ),
            expectedLayoutContext,
          ];
        }
      }
    }
  }

  if (
    directSurfaceMemberType &&
    willCarryAsRuntimeUnion(directSurfaceMemberType, context) &&
    willCarryAsRuntimeUnion(expectedType, context) &&
    runtimeUnionAliasReferencesMatch(
      directSurfaceMemberType,
      expectedType,
      context
    )
  ) {
    return [narrowed.exprAst, context];
  }

  if (
    directSurfaceMemberType &&
    willCarryAsRuntimeUnion(expectedType, context) &&
    !willCarryAsRuntimeUnion(directSurfaceMemberType, context)
  ) {
    const [expectedLayout, expectedLayoutContext] = buildRuntimeUnionLayout(
      expectedType,
      context,
      emitTypeAst
    );
    if (expectedLayout) {
      const [directSurfaceTypeAst, directSurfaceContext] = emitTypeAst(
        directSurfaceMemberType,
        expectedLayoutContext
      );
      const matchingMemberIndices = expectedLayout.memberTypeAsts.flatMap(
        (memberTypeAst, index) =>
          memberTypeAst &&
          sameTypeAstSurface(
            stripNullableTypeAst(directSurfaceTypeAst),
            stripNullableTypeAst(memberTypeAst)
          )
            ? [index]
            : []
      );
      if (matchingMemberIndices.length === 1) {
        const [memberIndex] = matchingMemberIndices;
        if (memberIndex !== undefined) {
          return [
            buildRuntimeUnionFactoryCallAst(
              buildRuntimeUnionTypeAst(expectedLayout),
              memberIndex + 1,
              narrowed.exprAst
            ),
            directSurfaceContext,
          ];
        }
      }
    }
  }

  if (
    directMemberType &&
    matchesExpectedEmissionType(directMemberType, expectedType, context)
  ) {
    return [narrowed.exprAst, context];
  }

  if (
    directMemberType &&
    willCarryAsRuntimeUnion(expectedType, context) &&
    !willCarryAsRuntimeUnion(directMemberType, context)
  ) {
    const [expectedLayout, expectedLayoutContext] = buildRuntimeUnionLayout(
      expectedType,
      context,
      emitTypeAst
    );
    if (
      expectedLayout?.members.some((member) =>
        matchesExpectedEmissionType(directMemberType, member, context)
      )
    ) {
      return [narrowed.exprAst, expectedLayoutContext];
    }
  }

  const materialized = materializeDirectNarrowingAst(
    narrowed.exprAst,
    effectiveType,
    expectedType,
    context
  );

  return wrapMaterializedTargetAst(
    materialized[0],
    expectedType,
    materialized[1]
  );
};
