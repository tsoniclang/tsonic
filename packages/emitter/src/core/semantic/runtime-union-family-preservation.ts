import type { IrType } from "@tsonic/frontend";
import {
  normalizedUnionType,
  runtimeUnionCarrierFamilyKey,
} from "@tsonic/frontend";

export const rebuildUnionTypePreservingCarrierFamily = (
  sourceUnion: Extract<IrType, { kind: "unionType" }>,
  nextTypes: readonly IrType[]
): IrType => {
  if (nextTypes.length === 1) {
    return nextTypes[0] ?? sourceUnion;
  }

  const preservedFamilyKey =
    sourceUnion.runtimeCarrierFamilyKey ??
    runtimeUnionCarrierFamilyKey(sourceUnion);

  if (sourceUnion.preserveRuntimeLayout === true) {
    return {
      ...sourceUnion,
      types: [...nextTypes],
      runtimeCarrierFamilyKey: preservedFamilyKey,
    };
  }

  return normalizedUnionType(nextTypes, {
    runtimeCarrierFamilyKey: preservedFamilyKey,
  });
};
