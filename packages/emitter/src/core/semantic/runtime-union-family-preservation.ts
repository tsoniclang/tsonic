import type { IrType } from "@tsonic/frontend";
import { normalizedUnionType } from "@tsonic/frontend";

export const rebuildUnionTypePreservingCarrierFamily = (
  sourceUnion: Extract<IrType, { kind: "unionType" }>,
  nextTypes: readonly IrType[]
): IrType => {
  if (nextTypes.length === 1) {
    return nextTypes[0] ?? sourceUnion;
  }

  if (sourceUnion.preserveRuntimeLayout === true) {
    return {
      ...sourceUnion,
      types: [...nextTypes],
    };
  }

  return normalizedUnionType(nextTypes, {
    ...(sourceUnion.runtimeCarrierFamilyKey !== undefined
      ? { runtimeCarrierFamilyKey: sourceUnion.runtimeCarrierFamilyKey }
      : {}),
    ...(sourceUnion.runtimeCarrierName !== undefined
      ? { runtimeCarrierName: sourceUnion.runtimeCarrierName }
      : {}),
    ...(sourceUnion.runtimeCarrierNamespace !== undefined
      ? { runtimeCarrierNamespace: sourceUnion.runtimeCarrierNamespace }
      : {}),
    ...(sourceUnion.runtimeCarrierTypeParameters !== undefined
      ? {
          runtimeCarrierTypeParameters:
            sourceUnion.runtimeCarrierTypeParameters,
        }
      : {}),
    ...(sourceUnion.runtimeCarrierTypeArguments !== undefined
      ? {
          runtimeCarrierTypeArguments: sourceUnion.runtimeCarrierTypeArguments,
        }
      : {}),
  });
};
