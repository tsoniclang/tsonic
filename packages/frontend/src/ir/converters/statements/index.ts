/**
 * Statement converters barrel exports
 */

// Helpers
export {
  convertTypeParameters,
  convertParameters,
  convertVariableDeclarationList,
  hasExportModifier,
  hasStaticModifier,
  hasReadonlyModifier,
  getAccessibility,
} from "./helpers.js";

// Control flow converters
export {
  convertIfStatement,
  convertWhileStatement,
  convertForStatement,
  convertForOfStatement,
  convertForInStatement,
  convertSwitchStatement,
  convertSwitchCase,
  convertTryStatement,
  convertCatchClause,
  convertBlockStatement,
} from "./control.js";

// Declaration converters
// Phase 5 Step 4: Removed setMetadataRegistry - no more global singletons
export {
  convertVariableStatement,
  convertFunctionDeclaration,
  convertClassDeclaration,
  convertInterfaceDeclaration,
  convertInterfaceMember,
  convertEnumDeclaration,
  convertTypeAliasDeclaration,
} from "./declarations.js";
