import type { Result } from "../../../types.js";
import {
  ensureInternalTypeImportsForFacade,
  ensureSourceTypeImportsForFacade,
  patchFacadeWithSourceFunctionSignatures,
  patchInternalIndexBrandMarkersOptional,
  patchInternalIndexWithMemberOverrides,
} from "../facade-patches.js";
import type { CollectedAugmentationData } from "./patch-data.js";

export const applyAugmentationData = (
  data: CollectedAugmentationData
): Result<void, string> => {
  for (const [internalIndex, overrides] of data.overridesByInternalIndex) {
    const result = patchInternalIndexWithMemberOverrides(internalIndex, overrides);
    if (!result.ok) return result;
  }

  for (const [internalIndex, typeNames] of data.brandOptionalTypesByInternalIndex) {
    const result = patchInternalIndexBrandMarkersOptional(
      internalIndex,
      Array.from(typeNames.values())
    );
    if (!result.ok) return result;
  }

  for (const [facadePath, signaturesByName] of data.functionSignaturesByFacade) {
    const result = patchFacadeWithSourceFunctionSignatures(
      facadePath,
      signaturesByName
    );
    if (!result.ok) return result;
  }

  for (const [facadePath, importsByLocalName] of data.sourceTypeImportsByFacade) {
    const result = ensureSourceTypeImportsForFacade(
      facadePath,
      importsByLocalName
    );
    if (!result.ok) return result;
  }

  for (const facadePath of data.functionSignaturesByFacade.keys()) {
    const result = ensureInternalTypeImportsForFacade(facadePath);
    if (!result.ok) return result;
  }

  for (const facadePath of data.sourceTypeImportsByFacade.keys()) {
    if (data.functionSignaturesByFacade.has(facadePath)) continue;
    const result = ensureInternalTypeImportsForFacade(facadePath);
    if (!result.ok) return result;
  }

  return { ok: true, value: undefined };
};
