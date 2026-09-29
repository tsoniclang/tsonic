import type {
  ReadonlySourceFactResolver,
  Type,
  TypeCheckerQueries,
  TypeShapeQueries,
} from "@tsonic/tsts";
import {
  providerTypeFamilyFactKey,
  providerVirtualDeclarationFactKey,
} from "@tsonic/tsts";
import {
  sourceTypeFactSubjects,
} from "./fact-subjects.js";

export type SourceTypeRelationship =
  | "identical"
  | "same-declaration"
  | "unrelated";

export function sourceTypeRelationship(
  types: TypeShapeQueries,
  checker: TypeCheckerQueries,
  facts: ReadonlySourceFactResolver,
  left: Type,
  right: Type,
): SourceTypeRelationship {
  if (left === right) {
    return "identical";
  }
  if (!types.isTypeReference(left) || !types.isTypeReference(right)) {
    return "unrelated";
  }
  const leftTarget = types.getTypeReferenceTarget(left);
  if (
    leftTarget !== undefined &&
      leftTarget === types.getTypeReferenceTarget(right)
  ) {
    return "same-declaration";
  }
  const leftProviderIds = providerTypeDeclarationIds(checker, facts, left);
  return leftProviderIds.some((id) =>
      providerTypeDeclarationIds(checker, facts, right).includes(id))
    ? "same-declaration"
    : "unrelated";
}

function providerTypeDeclarationIds(
  checker: TypeCheckerQueries,
  facts: ReadonlySourceFactResolver,
  type: Type,
): readonly string[] {
  const ids = new Set<string>();
  for (const subject of sourceTypeFactSubjects(checker, type)) {
    const declaration = facts.getFact(
      subject,
      providerVirtualDeclarationFactKey,
    );
    if (declaration?.exportId !== undefined) {
      ids.add(providerDeclarationId(declaration));
    }
    const family = facts.getFact(subject, providerTypeFamilyFactKey);
    for (const variant of family?.variants ?? []) {
      if (variant.declaration.exportId !== undefined) {
        ids.add(providerDeclarationId(variant.declaration));
      }
    }
  }
  return [...ids];
}

function providerDeclarationId(
  declaration: {
    readonly providerId: string;
    readonly providerVersion: string;
    readonly providerModuleId: string;
    readonly exportId?: string;
  },
): string {
  return JSON.stringify([
    declaration.providerId,
    declaration.providerVersion,
    declaration.providerModuleId,
    declaration.exportId,
  ]);
}
