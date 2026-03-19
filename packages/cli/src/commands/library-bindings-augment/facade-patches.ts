export { indexFacadeFiles } from "./facade-patches/indexing.js";
export {
  patchInternalIndexBrandMarkersOptional,
  patchInternalIndexWithMemberOverrides,
} from "./facade-patches/internal-index.js";
export {
  collectSourceTypeImportsForSignature,
  patchFacadeWithSourceFunctionSignatures,
} from "./facade-patches/signatures.js";
export {
  ensureInternalTypeImportsForFacade,
  ensureSourceTypeImportsForFacade,
} from "./facade-patches/imports.js";
