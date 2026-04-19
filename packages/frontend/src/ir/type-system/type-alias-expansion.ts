import type { IrReferenceType, IrType } from "../types/index.js";
import {
  substituteIrType as irSubstitute,
  type TypeSubstitutionMap as IrSubstitutionMap,
} from "../types/ir-substitution.js";
import type { TypeSystemState } from "./type-system-state.js";
import { resolveTypeIdByName } from "./type-system-state.js";

export const expandReferenceAlias = (
  state: TypeSystemState,
  type: IrReferenceType
): IrType | undefined => {
  const typeId =
    type.typeId ??
    resolveTypeIdByName(
      state,
      type.resolvedClrType ?? type.name,
      type.typeArguments?.length ?? 0
    );
  if (!typeId) {
    return undefined;
  }

  const entry = state.unifiedCatalog.getByTypeId(typeId);
  if (!entry?.aliasedType) {
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
