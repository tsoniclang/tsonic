export {
  registerCrossNamespaceReexport,
  registerCrossNamespaceTypeDeclaration,
  registerFacadeLocalTypeReferenceImports,
  registerInternalHelperTypeClosure,
  registerSourceTypeImportCandidates,
  registerValueExport,
  registerWrapperImports,
} from "./namespace-planning-helpers/registration.js";
export {
  collectAnonymousHelperClassNamesByShape,
  collectAnonymousMemberOverrides,
  registerAnonymousHelperClass,
} from "./namespace-planning-helpers/anonymous.js";
