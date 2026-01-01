/**
 * Declaration converters (variables, functions, classes, interfaces, enums, type aliases)
 * Main dispatcher - re-exports from declarations/ subdirectory
 *
 * ALICE'S SPEC: getTypeRegistry/getNominalEnv are deprecated.
 * Use TypeSystem via getTypeSystem() for all type queries.
 */

export {
  setMetadataRegistry,
  setBindingRegistry,
  setTypeRegistry,
  setNominalEnv,
  clearTypeRegistries,
  // TypeSystem singleton - single source of truth for type queries
  setTypeSystem,
  getTypeSystem,
  // Internal accessors - only for TypeSystem construction
  _internalGetTypeRegistry,
  _internalGetNominalEnv,
  convertVariableStatement,
  convertFunctionDeclaration,
  convertClassDeclaration,
  convertInterfaceDeclaration,
  convertInterfaceMember,
  convertEnumDeclaration,
  convertTypeAliasDeclaration,
} from "./declarations/index.js";
