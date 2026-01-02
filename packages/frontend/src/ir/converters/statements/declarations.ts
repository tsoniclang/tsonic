/**
 * Declaration converters (variables, functions, classes, interfaces, enums, type aliases)
 * Main dispatcher - re-exports from declarations/ subdirectory
 *
 * Phase 5 Step 4: Registry singletons removed.
 * All context now flows through ProgramContext.
 */

export {
  convertVariableStatement,
  convertFunctionDeclaration,
  convertClassDeclaration,
  convertInterfaceDeclaration,
  convertInterfaceMember,
  convertEnumDeclaration,
  convertTypeAliasDeclaration,
} from "./declarations/index.js";
