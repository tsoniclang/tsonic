import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { emitTypeAst } from "../../type-emitter.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";
import {
  sameTypeAstSurface,
  stripNullableTypeAst,
} from "../../core/format/backend-ast/utils.js";
import { matchesExpectedEmissionType } from "../../core/semantic/expected-type-matching.js";
import { tryBuildRuntimeMaterializationAst } from "../../core/semantic/runtime-reification.js";
import { buildRuntimeUnionLayout } from "../../core/semantic/runtime-unions.js";
import { runtimeUnionAliasReferencesMatch } from "../../core/semantic/runtime-union-alias-identity.js";
import { wrapMaterializedTargetAst } from "./storage-surface-shared.js";

export const tryEmitSourceCarrierMemberProjection = ({
  sourceCarrierAst,
  sourceType,
  effectiveType,
  expectedType,
  context,
}: {
  readonly sourceCarrierAst: CSharpExpressionAst;
  readonly sourceType: IrType;
  readonly effectiveType: IrType;
  readonly expectedType: IrType;
  readonly context: EmitterContext;
}): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (
    !runtimeUnionAliasReferencesMatch(effectiveType, expectedType, context) &&
    !matchesExpectedEmissionType(effectiveType, expectedType, context)
  ) {
    return undefined;
  }

  const [sourceLayout, sourceLayoutContext] = buildRuntimeUnionLayout(
    sourceType,
    context,
    emitTypeAst
  );
  const matchingMemberIndices = sourceLayout?.members.flatMap(
    (member, index) =>
      member &&
      matchesExpectedEmissionType(member, expectedType, sourceLayoutContext)
        ? [index]
        : []
  );
  const materializableMemberIndices = sourceLayout?.members.flatMap(
    (member, index) => {
      if (!member) {
        return [];
      }

      if (
        matchesExpectedEmissionType(member, expectedType, sourceLayoutContext)
      ) {
        return [index];
      }

      const nestedMaterialization = tryBuildRuntimeMaterializationAst(
        {
          kind: "identifierExpression",
          identifier: `__tsonic_source_member_${index + 1}`,
        },
        member,
        expectedType,
        sourceLayoutContext,
        emitTypeAst
      );
      return nestedMaterialization ? [index] : [];
    }
  );
  if (
    !sourceLayout ||
    matchingMemberIndices?.length !== 1 ||
    materializableMemberIndices?.length !== 1
  ) {
    return undefined;
  }

  const [memberIndex] = matchingMemberIndices;
  const sourceMemberTypeAst =
    memberIndex !== undefined
      ? sourceLayout.memberTypeAsts[memberIndex]
      : undefined;
  const [expectedTypeAst, expectedTypeContext] = emitTypeAst(
    expectedType,
    sourceLayoutContext
  );
  if (
    memberIndex === undefined ||
    !sourceMemberTypeAst ||
    !sameTypeAstSurface(
      stripNullableTypeAst(sourceMemberTypeAst),
      stripNullableTypeAst(expectedTypeAst)
    )
  ) {
    return undefined;
  }

  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: sourceCarrierAst,
        memberName: `As${memberIndex + 1}`,
      },
      arguments: [],
    },
    expectedTypeContext,
  ];
};

export const tryMaterializeStorageRuntimeUnionMember = ({
  storageExprAst,
  sourceType,
  expectedType,
  context,
}: {
  readonly storageExprAst: CSharpExpressionAst;
  readonly sourceType: IrType;
  readonly expectedType: IrType;
  readonly context: EmitterContext;
}): [CSharpExpressionAst, EmitterContext] | undefined => {
  const [sourceLayout, sourceLayoutContext] = buildRuntimeUnionLayout(
    sourceType,
    context,
    emitTypeAst
  );
  const selectedSourceMemberNs = sourceLayout?.members.flatMap(
    (member, index) => {
      if (!member) {
        return [];
      }

      if (
        runtimeUnionAliasReferencesMatch(
          member,
          expectedType,
          sourceLayoutContext
        ) ||
        matchesExpectedEmissionType(member, expectedType, sourceLayoutContext)
      ) {
        return [index + 1];
      }

      const nestedMaterialization = tryBuildRuntimeMaterializationAst(
        {
          kind: "identifierExpression",
          identifier: `__tsonic_source_member_${index + 1}`,
        },
        member,
        expectedType,
        sourceLayoutContext,
        emitTypeAst
      );
      return nestedMaterialization ? [index + 1] : [];
    }
  );
  if (selectedSourceMemberNs?.length !== 1) {
    return undefined;
  }

  const storageMaterialized = tryBuildRuntimeMaterializationAst(
    storageExprAst,
    sourceType,
    expectedType,
    sourceLayoutContext,
    emitTypeAst,
    new Set(selectedSourceMemberNs)
  );
  if (!storageMaterialized) {
    return undefined;
  }

  return wrapMaterializedTargetAst(
    storageMaterialized[0],
    expectedType,
    storageMaterialized[1]
  );
};
