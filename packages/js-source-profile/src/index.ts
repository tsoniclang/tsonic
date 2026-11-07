export { sourceNoLibBaseDeclarations } from "./declarations/base.js";
export { jsRegExpSourceProfileDeclarations, jsStandardSourceProfileDeclarations } from "./declarations/composition.js";
export { jsRegExpObjectDeclarations } from "./declarations/regexp.js";
export { jsRegExpResultDeclarations } from "./declarations/regexp-results.js";
export { jsCapabilitySourceProfileDeclarations } from "./declarations/capabilities.js";
export { jsRegExpSymbolDeclarations } from "./declarations/symbol-regexp.js";
export { jsStringRegExpDeclarations } from "./declarations/string-regexp.js";
export { jsRegExpSourceProfileIdentity } from "./identities/regexp.js";
export {
  jsLangModule,
  jsSourcePackageName,
  jsSourceSemanticsIdentity,
  jsTypesModule,
} from "./identities/source.js";
export { jsSourceSemanticsModules } from "./extension/source-modules.js";
export { jsSourceExtensionContribution } from "./extension/source-extension.js";
export { createJsSourceVirtualModulesProvider } from "./extension/source-virtual-modules.js";
export { jsRegExpTypeLibraryContract } from "./type-library-contract.js";
export { sourceErrorDeclarations } from "./declarations/errors.js";
export { sourcePrimitiveProfileDeclarations } from "./declarations/primitives.js";
export { jsSurfaceSourceProfileDeclarations } from "./declarations/globals.js";
export { jsTypedArrayElementKinds } from "./declarations/typed-arrays.js";
// The JS API facts (D18): every JS API meaning, identity and effect reaches a target and the Host through
// facts.profile only (createJsSourceApiFacts is the composition root's profile factory).
export { createJsSourceApiFacts } from "./api/facts.js";
