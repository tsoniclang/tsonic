export {
  jsRegExpObjectDeclarations,
  jsRegExpResultDeclarations,
  jsRegExpSourceProfileDeclarations,
  jsRegExpSymbolDeclarations,
  jsStringRegExpDeclarations,
} from "./declarations/composition.js";
export { jsRegExpSourceProfileIdentity } from "./identities/regexp.js";
export {
  jsLangModule,
  jsSourcePackageName,
  jsSourceSemanticsIdentity,
  jsTypesModule,
} from "./identities/source.js";
export { jsSourceSemanticsModules } from "./extension/source-modules.js";
export { createJsSourceSemanticsExtension } from "./extension/source-extension.js";
export { createJsSourceVirtualModulesProvider } from "./extension/source-virtual-modules.js";
export { jsRegExpTypeLibraryContract } from "./type-library-contract.js";
