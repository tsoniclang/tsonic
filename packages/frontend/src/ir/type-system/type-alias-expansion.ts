import type { IrReferenceType, IrType } from "../types/index.js";
import {
  substituteIrType as irSubstitute,
  type TypeSubstitutionMap as IrSubstitutionMap,
} from "../types/ir-substitution.js";
import type { TypeSystemState } from "./type-system-state.js";
import { resolveTypeIdByName } from "./type-system-state.js";
import type { TypeId } from "./internal/universe/types.js";

const collectAliasResolutionCandidates = (
  state: TypeSystemState,
  type: IrReferenceType
): readonly TypeId[] => {
  const candidates: TypeId[] = [];
  const pushCandidate = (candidate: TypeId | undefined): void => {
    if (!candidate) {
      return;
    }
    if (
      candidates.some((existing) => existing.stableId === candidate.stableId)
    ) {
      return;
    }
    candidates.push(candidate);
  };

  pushCandidate(type.typeId);
  pushCandidate(
    resolveTypeIdByName(
      state,
      type.providerQualifiedName ?? type.name,
      type.typeArguments?.length ?? 0
    )
  );
  if (type.typeId?.ownerIdentity && type.typeId.sourceName) {
    pushCandidate(
      resolveTypeIdByName(
        state,
        `${type.typeId.ownerIdentity}.${type.typeId.sourceName}`,
        type.typeArguments?.length ?? 0
      )
    );
  }
  pushCandidate(
    resolveTypeIdByName(state, type.name, type.typeArguments?.length ?? 0)
  );

  return candidates;
};

export const expandReferenceAlias = (
  state: TypeSystemState,
  type: IrReferenceType
): IrType | undefined => {
  const rightmostTypeName = type.name.includes(".")
    ? type.name.slice(type.name.lastIndexOf(".") + 1)
    : undefined;
  const registryAliasEntry = [
    type.name,
    rightmostTypeName,
    type.typeId?.sourceName,
    type.providerQualifiedName,
  ]
    .filter((name): name is string => name !== undefined)
    .flatMap((name) => state.typeRegistry.getFQNames(name))
    .map((fqName) => state.typeRegistry.resolveNominal(fqName))
    .find((candidate) => candidate?.aliasedType !== undefined);

  const catalogAliasEntry = collectAliasResolutionCandidates(state, type)
    .map((typeId) => state.unifiedCatalog.getByTypeId(typeId))
    .find((candidate) => candidate?.aliasedType);
  const entry = registryAliasEntry ?? catalogAliasEntry;
  if (!entry?.aliasedType) {
    const sourceCarrierName =
      catalogAliasEntry?.sourceCarrierName ??
      (catalogAliasEntry?.iterableShape && type.typeId?.sourceName
        ? `${type.typeId.sourceName}$instance`
        : undefined);
    if (!sourceCarrierName) {
      return undefined;
    }

    return {
      kind: "referenceType",
      name: sourceCarrierName,
      ...(type.typeArguments ? { typeArguments: type.typeArguments } : {}),
      ...(type.providerQualifiedName
        ? { providerQualifiedName: type.providerQualifiedName }
        : {}),
      ...(type.iterableShape ? { iterableShape: type.iterableShape } : {}),
      structuralOrigin: "namedReference",
    };
  }

  if (
    entry.aliasedType.kind === "objectType" &&
    type.structuralOrigin === "namedReference" &&
    (type.structuralMembers?.length ?? 0) > 0
  ) {
    return undefined;
  }

  const aliasSubstitution = new Map<string, IrType>();
  const aliasTypeParameters = entry.typeParameters;
  const aliasTypeArguments = type.typeArguments ?? [];
  for (
    let index = 0;
    index < Math.min(aliasTypeParameters.length, aliasTypeArguments.length);
    index += 1
  ) {
    const typeParameter = aliasTypeParameters[index];
    const typeArgument = aliasTypeArguments[index];
    if (typeParameter && typeArgument) {
      aliasSubstitution.set(typeParameter.name, typeArgument);
    }
  }

  return aliasSubstitution.size > 0
    ? irSubstitute(entry.aliasedType, aliasSubstitution as IrSubstitutionMap)
    : entry.aliasedType;
};
