/**
 * Declaration converters (variables, functions, classes, interfaces, enums, type aliases)
 * Main dispatcher - re-exports from declarations/ subdirectory
 */

export {
  setMetadataRegistry,
  setBindingRegistry,
  setTypeRegistry,
  setNominalEnv,
  getTypeRegistry,
  getNominalEnv,
  clearTypeRegistries,
  convertVariableStatement,
  convertFunctionDeclaration,
  convertClassDeclaration,
  convertInterfaceDeclaration,
  convertInterfaceMember,
  convertEnumDeclaration,
  convertTypeAliasDeclaration,
} from "./declarations/index.js";
